(() => {
      /* ============================
       * 1) CDN helper + preconnect
       * ============================ */
      const CDN_HOST = null; // <— ZMIEŃ jeśli używasz innego hosta CDN
      const isHttpUrl = (u) => /^https?:\/\//i.test(u);

      // Wstrzyknij preconnect/dns-prefetch (robimy to dynamicznie, żeby nie ruszać <head>)
      try {
        const head = document.head || document.getElementsByTagName('head')[0];
        if (head && CDN_HOST) {
          const mk = (tag, attrs) => {
            const el = document.createElement(tag);
            Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, v));
            return el;
          };
          // nie duplikuj
          if (!document.querySelector(`link[rel="preconnect"][href="${CDN_HOST}"]`)) {
            head.appendChild(mk('link', { rel: 'preconnect', href: CDN_HOST, crossorigin: '' }));
          }
          if (!document.querySelector(`link[rel="dns-prefetch"][href="//${CDN_HOST.replace(/^https?:\/\//,'')}"]`)) {
            head.appendChild(mk('link', { rel: 'dns-prefetch', href: '//' + CDN_HOST.replace(/^https?:\/\//,'') }));
          }
        }
      } catch(e){ /* no-op */ }

      // Helper mapujący origin → CDN (zachowuje ścieżkę)
      function toCDN(url) {
        if (!url || !CDN_HOST) return url;
        try {
          // jeśli już CDN — zostaw
          if (url.startsWith(CDN_HOST)) return url;
          // jeśli absolutny http(s) — podmień tylko host
          if (isHttpUrl(url)) {
            const u = new URL(url);
            const c = new URL(CDN_HOST);
            return `${c.origin}${u.pathname}${u.search}${u.hash}`;
          }
          // jeśli względny — dolej do CDN
          return CDN_HOST.replace(/\/+$/,'') + '/' + url.replace(/^\/+/, '');
        } catch {
          return url;
        }
      }

      // Podmień src na CDN przy pierwszym ustawieniu źródeł (bez grzebania w Twoich funkcjach)
      // — obejście: obserwujemy dodawanie/zmianę <source>/<video>
      const mm = new MutationObserver(muts => {
        for (const m of muts) {
          const nodes = Array.from(m.addedNodes || []);
          for (const n of nodes) rewriteSources(n);
          if (m.type === 'attributes' && (m.target.tagName === 'SOURCE' || m.target.tagName === 'VIDEO') && m.attributeName === 'src') {
            rewriteNodeSrc(m.target);
          }
        }
      });
      mm.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

      function rewriteSources(root) {
        if (!root || !CDN_HOST) return;
        if (root.tagName === 'SOURCE' || root.tagName === 'VIDEO') rewriteNodeSrc(root);
        root.querySelectorAll?.('source, video').forEach(rewriteNodeSrc);
      }
      function rewriteNodeSrc(el) {
        try {
          const src = el.getAttribute('src');
          if (!src) return;
          const mapped = toCDN(src);
          if (mapped && mapped !== src) el.setAttribute('src', mapped);
        } catch(e){}
      }

      /* ===========================================
       * 2) Prefetch następnego slajdu (JIT, lekki)
       * =========================================== */
      function slideSelector() {
        return document.querySelectorAll('.slide, .webyx-section');
      }
      function getNextSlide(el) {
        let p = el.nextElementSibling;
        while (p && !(p.classList?.contains('slide') || p.classList?.contains('webyx-section'))) {
          p = p.nextElementSibling;
        }
        return p || null;
      }
      function prefetchSlide(slide) {
        if (!slide || slide.__tt_prefetched) return;
        const v = slide.querySelector?.('video');
        if (v) {
          v.setAttribute('preload', 'metadata');
        }
        slide.__tt_prefetched = true;
      }

      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const next = getNextSlide(e.target);
            if (next) prefetchSlide(next);
          }
        });
      }, { root: null, rootMargin: '150% 0px 150% 0px', threshold: 0.01 });

      const bootPrefetch = () => slideSelector().forEach(s => io.observe(s));
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootPrefetch, { once: true });
      } else {
        bootPrefetch();
      }

      /* ======================================================
       * 3) iOS: unmute na WYBORZE JĘZYKA (tak jak Android)
       * ====================================================== */
      const isIOS = () => /iP(hone|ad|od)/i.test(navigator.userAgent) ||
                           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      function unlockAudioFromLangChoiceOnce() {
        if (!isIOS()) return;
        let unlocked = false;
        const handler = (ev) => {
          const t = ev.target.closest?.('[data-lang], .lang-option, .language-option, .lang-flag, [data-translate-lang]');
          if (!t) return;
          if (unlocked) return;
          unlocked = true;

          const vids = document.querySelectorAll('video');
          vids.forEach(v => {
            try {
              v.muted = false;
              const p = v.play();
              if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch(e){}
          });

          document.removeEventListener('click', handler, true);
        };
        document.addEventListener('click', handler, true);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', unlockAudioFromLangChoiceOnce, { once: true });
      } else {
        unlockAudioFromLangChoiceOnce();
      }

    })();

    document.addEventListener('DOMContentLoaded', () => {

        // Guard for undefined WordPress objects in standalone mode
        if (typeof window.ajax_object === 'undefined') {
            console.warn('`ajax_object` is not defined. Using mock data for standalone development.');
            window.ajax_object = {
                ajax_url: '#', // Prevent actual network requests
                nonce: '0a1b2c3d4e'
            };
        }

        if (typeof window.TingTongData === 'undefined') {
            console.warn('`TingTongData` is not defined. Using mock data for standalone development.');
            window.TingTongData = {
                isLoggedIn: false, // Start as logged out
                slides: [
                    {
                        'id': 'slide-001',
                        'likeId': '1',
                        'user': 'Paweł Polutek',
                        'description': 'To jest dynamicznie załadowany opis dla pierwszego slajdu. Działa!',
                        'mp4Url': 'https://pawelperfect.pl/wp-content/uploads/2025/07/17169505-hd_1080_1920_30fps.mp4',
                        'hlsUrl': null,
                        'poster': '',
                        'avatar': 'https://i.pravatar.cc/100?u=pawel',
                        'access': 'public',
                        'initialLikes': 1500,
                        'isLiked': false,
                        'initialComments': 567
                    },
                    {
                        'id': 'slide-002',
                        'likeId': '2',
                        'user': 'Web Dev',
                        'description': 'Kolejny slajd, kolejne wideo. #efficiency',
                        'mp4Url': 'https://pawelperfect.pl/wp-content/uploads/2025/07/4434150-hd_1080_1920_30fps-1.mp4',
                        'hlsUrl': null,
                        'poster': '',
                        'avatar': 'https://i.pravatar.cc/100?u=webdev',
                        'access': 'public',
                        'initialLikes': 2200,
                        'isLiked': false,
                        'initialComments': 1245
                    }
                ]
            };
        }

        /**
         * ==========================================================================
         * 1. CONFIGURATION & APP DATA
         * ==========================================================================
         */
        const Config = {
          USE_HLS: true,
          PREFETCH_NEIGHBORS: true,
          PREFETCH_MARGIN: '150%',
          UNLOAD_FAR_SLIDES: true,
          FAR_DISTANCE: 2,
          LOW_DATA_MODE: false,
          RETRY_MAX_ATTEMPTS: 2,
          RETRY_BACKOFF_MS: 800,
          METRICS_ENDPOINT: '/api/tt-metrics',
          DEBUG_PANEL: true,
          GESTURE_GRACE_PERIOD_MS: 2000,
          LQIP_POSTER: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBAUEBAYFBQUGBgYHCQ4JCQgICRINDQoOFRIWFhUSFBQXGIctGhgoMSA+PIxCSkdHTFROU2A3NkVJQkpbY2P/2wBDAQYGBgoJEQoSDxAHExQXHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx//wAARCAAoABQDASIAAhEBAxEB/8QAGAAAAwEBAAAAAAAAAAAAAAAAAAIDAQT/xAAfEAEAAgICAwEBAAAAAAAAAAABAhEDBCESMUFRYnH/xAAaAQADAQEBAQAAAAAAAAAAAAAAAQIDBAUG/8QAHREAAgICAwEBAAAAAAAAAAAAAAECEQMhEjFBYf/a.AABEIAKAAYQMBIgACEQEDEQA/AOgY2XQk9RLbl+nEdI9Tae4grQYdQl5+Lq+wMv04jo9W45pTDl30y9U2nuJpDDy7aZeobT3EFaDBzH6cvVtp7iaQYOY/Tl6ttPcQVcDBzH6cvVtp7iAtgYOY/Tl6ttPcQFoMHGfpz9W2nuIC2Bg4z9Ofq209xAWgwcZ+nP1ba+4gLgYOM/Tn6ttPcQFoMHGfpz9W2nuIC0GDjP05+re09xAWgwcZ+nL1ba+4gLpL2DCPxZeqbT3EFaDBxH6cvVtp7iCtBg4j9OXq209xBWgwcR+nL1ba+4grQYOY/Tl6ttPcQVcDBzH6cvVtp7iAtgYOY/Tl6ttPcQFoMHGfpz9W2nuIC0GDjP05+re09xAWgwcZ+nL1ba+4gukvYMI/Fl6ptPcQVoMHGfpz9W2nuICtBg4j9OXq209xBWgwcR+nL1ba+4grQYOY/Tl6ttPcQVsDBzH6cvVtp7iAtgYOM/Tl6ttPcQFoMHGfpz9W2nuIC0GDjP05+re09xAWgwcZ+nL1ba+4gukvYMI/Fl6ptPcQVoMGHkP05eqbT3EFaDBh5D9OXqm09xBWgweQ/Tl6ptPcQVcDB5D9OXq209xBWwMHkP05erbT3EBaDB5D9OXq209xAWgweR+nP1bae4gLpP//Z',
          HLS: {
            abrEnabled: true,
            capLevelToPlayerSize: true,
            startLevel: -1,
            abrEwmaFastLive: true,
            maxAutoLevelCapping: null
          },
          TRANSLATIONS: {
            pl: { loggedOutText: "Nie masz psychy się zalogować", loggedInText: 'Jesteś zalogowany', loginSuccess: "Zalogowano pomyślnie!", loginFailed: "Logowanie nie powiodło się. Spróbuj ponownie.", accountHeaderText: 'Konto', menuAriaLabel: 'Menu', subscribeAriaLabel: 'subskrajbować', shareTitle: 'Udostępnij', shareAriaLabel: 'Udostępnij', shareText: 'Szeruj', infoTitle: 'OCB?!', infoAriaLabel: 'OCB?!', infoText: 'OCB?!', tipTitle: 'Napiwek', tipAriaLabel: 'Napiwek', tipText: 'Napiwek', languageAriaLabel: 'Zmień język', languageText: 'PL', subscribeAlert: 'Zaloguj się, aby subskrajbować.', likeAlert: 'Zaloguj się, aby lajkować.', notificationAlert: 'Zaloguj się i bądź na bieżąco.', menuAccessAlert: 'Zaloguj się, aby uzyskać dostęp do menu.', logoutSuccess: 'Zostałeś wylogowany.', likeError: 'Błąd komunikacji z serwerem.', secretTitle: 'Ściśle Tajne', secretSubtitle: 'Zaloguj się, aby odblokować', infoModalTitle: 'OCB?!', infoModalBodyP1: 'Lorem ipsum dolor sit amet...', infoModalBodyP2: 'Ut in nulla enim...', infoModalBodyTip: 'Podoba Ci się? Zostaw napiwek...', infoModalBodyP3: 'Donec id elit non mi porta...', closeAccountAriaLabel: 'Zamknij panel konta', closeInfoAriaLabel: 'Zamknij informacje', accountMenuButton: 'Konto', logoutLink: 'Wyloguj', profileTab: 'Profil', passwordTab: 'Hasło', deleteTab: 'Usuń konto', loggedInState: 'Zalogowany', loggedOutState: 'Gość', linkCopied: 'Link skopiowany do schowka!', likeAriaLabel: 'Polub', notificationAriaLabel: 'Powiadomienia', commentsAriaLabel: 'Komentarze', commentsModalTitle: 'Komentarze', closeCommentsAriaLabel: 'Zamknij komentarze', likeAriaLabelWithCount: 'Polub. Aktualna liczba polubień: {count}', unlikeAriaLabelWithCount: 'Cofnij polubienie. Aktualna liczba polubień: {count}', notificationsTitle: 'Powiadomienia', closeNotificationsAriaLabel: 'Zamknij powiadomienia', notificationsEmpty: 'Wszystko na bieżąco!', notif1Preview: 'Nowa wiadomość od Admina', notif1Time: '2 min temu', notif1Full: 'Cześć! Chcieliśmy tylko dać znać, że nowa wersja aplikacji jest już dostępna. Sprawdź nowe funkcje w panelu konta!', notif2Preview: 'Twój profil został zaktualizowany', notif2Time: '10 min temu', notif2Full: 'Twoje zmiany w profilu zostały pomyślnie zapisane. Możesz je przejrzeć w dowolnym momencie, klikając w swój awatar.', notif3Preview: 'Specjalna oferta czeka na Ciebie!', notif3Time: '1 godz. temu', notif3Full: 'Nie przegap! Przygotowaliśmy dla Ciebie specjalną letnią promocję. Zgarnij dodatkowe bonusy już teraz. Oferta ograniczona czasowo.' },
            en: { loggedOutText: "You don't have the guts to log in", loggedInText: 'You are logged in', loginSuccess: "Logged in successfully!", loginFailed: "Login failed. Please try again.", accountHeaderText: 'Account', menuAriaLabel: 'Menu', subscribeAriaLabel: 'Subscribe', shareTitle: 'Share', shareAriaLabel: 'Share', shareText: 'Share', infoTitle: 'WTF?!', infoAriaLabel: 'WTF?!', infoText: 'WTF?!', tipTitle: 'Tip', tipAriaLabel: 'Tip', tipText: 'Tip', languageAriaLabel: 'Change language', languageText: 'EN', subscribeAlert: 'Log in to subscribe.', likeAlert: 'Log in to like.', notificationAlert: 'Log in to stay up to date.', menuAccessAlert: 'Log in to access the menu.', logoutSuccess: 'You have been logged out.', likeError: 'Server communication error.', secretTitle: 'Top Secret', secretSubtitle: 'Log in to unlock', infoModalTitle: 'WTF?!', infoModalBodyP1: 'Lorem ipsum dolor sit amet...', infoModalBodyP2: 'Ut in nulla enim...', infoModalBodyTip: 'Enjoying the app? Leave a tip...', infoModalBodyP3: 'Donec id elit non mi porta...', closeAccountAriaLabel: 'Close account panel', closeInfoAriaLabel: 'Close information', accountMenuButton: 'Account', logoutLink: 'Logout', profileTab: 'Profile', passwordTab: 'Password', deleteTab: 'Delete account', loggedInState: 'Logged In', loggedOutState: 'Guest', linkCopied: 'Link copied to clipboard!', likeAriaLabel: 'Like', notificationAriaLabel: 'Notifications', commentsAriaLabel: 'Comments', commentsModalTitle: 'Comments', closeCommentsAriaLabel: 'Close comments', likeAriaLabelWithCount: 'Like. Current likes: {count}', unlikeAriaLabelWithCount: 'Unlike. Current likes: {count}', notificationsTitle: 'Notifications', closeNotificationsAriaLabel: 'Close notifications', notificationsEmpty: 'You are all caught up!', notif1Preview: 'New message from Admin', notif1Time: '2 mins ago', notif1Full: 'Hi there! Just wanted to let you know that a new version of the app is available. Check out the new features in your account panel!', notif2Preview: 'Your profile has been updated', notif2Time: '10 mins ago', notif2Full: 'Your profile changes have been saved successfully. You can review them anytime by clicking on your avatar.', notif3Preview: 'A special offer is waiting for you!', notif3Time: '1 hour ago', notif3Full: 'Don\'t miss out! We have prepared a special summer promotion just for you. Grab your extra bonuses now. Limited time offer.' }
          }
        };

        const slidesData = (typeof TingTongData !== 'undefined' && Array.isArray(TingTongData.slides)) ? TingTongData.slides : [];
        slidesData.forEach(s => { s.likeId = String(s.likeId); });


        /**
         * ==========================================================================
         * 2. STATE MANAGEMENT
         * ==========================================================================
         */
        const State = (function() {
            const _state = {
                isUserLoggedIn: (typeof TingTongData !== 'undefined' && TingTongData.isLoggedIn) || false,
                currentLang: 'pl',
                currentSlideIndex: 0,
                isAutoplayBlocked: false,
                isDraggingProgress: false,
                lastFocusedElement: null,
                lastUserGestureTimestamp: 0,
                activeVideoSession: 0,
            };

            return {
                get: (key) => _state[key],
                set: (key, value) => { _state[key] = value; },
                getState: () => ({ ..._state }),
            };
        })();

        /**
         * ==========================================================================
         * 3. UTILITIES
         * ==========================================================================
         */
        const Utils = (function() {
            return {
                getTranslation: (key) => (Config.TRANSLATIONS[State.get('currentLang')]?.[key]) || key,
                formatCount: (count) => {
                    count = Number(count) || 0;
                    if (count >= 1000000) return (count / 1000000).toFixed(1).replace('.0', '') + 'M';
                    if (count >= 1000) return (count / 1000).toFixed(1).replace('.0', '') + 'K';
                    return String(count);
                },
                fixProtocol: (url) => {
                    if (!url) return url;
                    try {
                        if (window.location.protocol === 'https:') {
                            const urlObj = new URL(url, window.location.origin);
                            if (urlObj.protocol === 'http:') {
                                urlObj.protocol = 'https:';
                                return urlObj.toString();
                            }
                        }
                    } catch (e) { /* Invalid URL, return as is */ }
                    return url;
                },
                toRelativeIfSameOrigin: (url) => {
                    if (!url) return url;
                    try {
                        const urlObj = new URL(url, window.location.origin);
                        if (urlObj.origin === window.location.origin) {
                            return urlObj.pathname + urlObj.search + urlObj.hash;
                        }
                    } catch (e) { /* Invalid URL, return as is */ }
                    return url;
                },
                vibrateTry: (ms = 35) => {
                    if (navigator.vibrate) {
                        try { navigator.vibrate(ms); } catch(e) {}
                    }
                },
                recordUserGesture: () => {
                    State.set('lastUserGestureTimestamp', Date.now());
                },
                setAppHeightVar: () => {
                  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
                }
            };
        })();

        /**
         * ==========================================================================
         * 4. API MODULE
         * ==========================================================================
         */
        const API = (function() {
            async function _request(action, data = {}) {
                try {
                    const body = new URLSearchParams({ action, nonce: ajax_object.nonce, ...data });
                    const response = await fetch(ajax_object.ajax_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                        credentials: 'same-origin',
                        body
                    });
                    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
                    const json = await response.json();
                    if (json.new_nonce) ajax_object.nonce = json.new_nonce;
                    return json;
                } catch (error) {
                    console.error(`API Client Error for action "${action}":`, error);
                    return { success: false, data: { message: error.message } };
                }
            }

            return {
                login: (data) => _request('tt_ajax_login', data),
                logout: () => _request('tt_ajax_logout'),
                toggleLike: (postId) => _request('toggle_like', { post_id: postId }),
                refreshNonce: async () => {
                    const json = await _request('tt_refresh_nonce');
                    if (json.success && json.nonce) ajax_object.nonce = json.nonce;
                    else console.error('Failed to refresh nonce.', json);
                },
                fetchSlidesData: () => _request('tt_get_slides_data_ajax'),
            };
        })();

        /**
         * ==========================================================================
         * 5. UI MODULE
         * ==========================================================================
         */
        const UI = (function() {
            const DOM = {
                container: document.getElementById('webyx-container'),
                template: document.getElementById('slide-template'),
                preloader: document.getElementById('preloader'),
                alertBox: document.getElementById('alertBox'),
                alertText: document.getElementById('alertText'),
                infoModal: document.getElementById('infoModal'),
                commentsModal: document.getElementById('commentsModal'),
                accountModal: document.getElementById('accountModal'),
                notificationPopup: document.getElementById('notificationPopup'),
            };
            let alertTimeout;

            function showAlert(message, isError = false) {
                if (!DOM.alertBox || !DOM.alertText) return;
                clearTimeout(alertTimeout);
                DOM.alertBox.style.animation = 'none';
                requestAnimationFrame(() => {
                    DOM.alertBox.style.animation = '';
                    DOM.alertText.textContent = message;
                    DOM.alertBox.style.backgroundColor = isError ? 'var(--accent-color)' : 'rgba(0, 0, 0, 0.85)';
                    DOM.alertBox.classList.add('visible');
                });
                alertTimeout = setTimeout(() => DOM.alertBox.classList.remove('visible'), 3000);
            }

            function getFocusable(node) {
                if (!node) return [];
                return Array.from(node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
            }

            function trapFocus(modal) {
                const focusable = getFocusable(modal);
                if (focusable.length === 0) return () => {};
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const handleKeyDown = (e) => {
                    if (e.key !== 'Tab') return;
                    if (e.shiftKey) {
                        if (document.activeElement === first) { last.focus(); e.preventDefault(); }
                    } else {
                        if (document.activeElement === last) { first.focus(); e.preventDefault(); }
                    }
                };
                modal.addEventListener('keydown', handleKeyDown);
                return () => modal.removeEventListener('keydown', handleKeyDown);
            }

            function openModal(modal) {
                State.set('lastFocusedElement', document.activeElement);
                DOM.container.setAttribute('aria-hidden', 'true');
                modal.classList.add('visible');
                modal.setAttribute('aria-hidden', 'false');
                const focusable = getFocusable(modal);
                (focusable.length > 0 ? focusable[0] : modal.querySelector('.modal-content'))?.focus();
                modal._focusTrapDispose = trapFocus(modal);
            }

            function closeModal(modal) {
                modal.classList.remove('visible');
                modal.setAttribute('aria-hidden', 'true');
                if (modal._focusTrapDispose) { modal._focusTrapDispose(); delete modal._focusTrapDispose; }
                DOM.container.removeAttribute('aria-hidden');
                State.get('lastFocusedElement')?.focus();
            }

            function updateLikeButtonState(likeButton, liked, count) {
                if (!likeButton) return;
                const likeCountEl = likeButton.querySelector('.like-count');
                likeButton.classList.toggle('active', liked);
                likeButton.setAttribute('aria-pressed', String(liked));
                if (likeCountEl) {
                    likeCountEl.textContent = Utils.formatCount(count);
                    likeCountEl.dataset.rawCount = String(count);
                }
                const translationKey = liked ? 'unlikeAriaLabelWithCount' : 'likeAriaLabelWithCount';
                const label = Utils.getTranslation(translationKey).replace('{count}', Utils.formatCount(count));
                likeButton.setAttribute('aria-label', label);
            }

            function applyLikeStateToDom(likeId, liked, count) {
                document.querySelectorAll(`.like-button[data-like-id="${likeId}"]`).forEach(btn => updateLikeButtonState(btn, liked, count));
            }

            function updateUIForLoginState() {
                const isLoggedIn = State.get('isUserLoggedIn');
                const currentSlideIndex = State.get('currentSlideIndex');

                DOM.container.querySelectorAll('.webyx-section').forEach((section) => {
                    const sim = section.querySelector('.tiktok-symulacja');
                    sim.classList.toggle('is-logged-in', isLoggedIn);
                    const isSecret = sim.dataset.access === 'secret';
                    const showSecretOverlay = isSecret && !isLoggedIn;

                    section.querySelector('.secret-overlay').classList.toggle('visible', showSecretOverlay);
                    section.querySelector('.videoPlayer').classList.toggle('secret-active', showSecretOverlay);
                    section.querySelector('.topbar .central-text-wrapper').classList.toggle('with-arrow', !isLoggedIn);
                    section.querySelector('.login-panel').classList.remove('active');
                    section.querySelector('.topbar').classList.remove('login-panel-active');
                    section.querySelector('.logged-in-menu').classList.remove('active');
                    section.querySelector('.topbar .topbar-text').textContent = isLoggedIn ? Utils.getTranslation('loggedInText') : Utils.getTranslation('loggedOutText');

                    const likeBtn = section.querySelector('.like-button');
                    if (likeBtn) {
                        const slide = slidesData.find(s => String(s.likeId) === String(likeBtn.dataset.likeId));
                        if (slide) {
                            updateLikeButtonState(likeBtn, !!(slide.isLiked && isLoggedIn), Number(slide.initialLikes || 0));
                        }
                    }

                    if (parseInt(section.dataset.index, 10) === currentSlideIndex) {
                        VideoManager.updatePlaybackForLoginChange(section, showSecretOverlay);
                    }
                });
            }

            function updateTranslations() {
                const lang = State.get('currentLang');
                document.documentElement.lang = lang;
                document.querySelectorAll('[data-translate-key]').forEach(el => el.textContent = Utils.getTranslation(el.dataset.translateKey));
                document.querySelectorAll('[data-translate-aria-label]').forEach(el => el.setAttribute('aria-label', Utils.getTranslation(el.dataset.translateAriaLabel)));
                document.querySelectorAll('[data-translate-title]').forEach(el => el.setAttribute('title', Utils.getTranslation(el.dataset.translateTitle)));
                updateUIForLoginState();
            }

            function createSlideElement(slideData, index) {
                const slideFragment = DOM.template.content.cloneNode(true);
                const section = slideFragment.querySelector('.webyx-section');
                section.dataset.index = index;
                section.dataset.slideId = slideData.id;

                const loginPanel = section.querySelector('.login-panel');
                const renderedForm = document.getElementById('um-login-render-container');
                if (loginPanel && renderedForm) {
                    loginPanel.innerHTML = renderedForm.innerHTML;
                    const form = loginPanel.querySelector('.login-form');
                    if (form) {
                        form.querySelector('label[for="user_login"]')?.remove();
                        form.querySelector('#user_login')?.setAttribute('placeholder', 'Login');
                        form.querySelector('label[for="user_pass"]')?.remove();
                        form.querySelector('#user_pass')?.setAttribute('placeholder', 'Hasło');
                        const submitButton = form.querySelector('#wp-submit');
                        if (submitButton) submitButton.value = 'ENTER';
                    }
                }

                section.querySelector('.tiktok-symulacja').dataset.access = slideData.access;
                section.querySelector('.videoPlayer').poster = slideData.poster || Config.LQIP_POSTER;
                section.querySelector('.profileButton img').src = slideData.avatar;
                section.querySelector('.text-user').textContent = slideData.user;
                section.querySelector('.text-description').textContent = slideData.description;

                const likeBtn = section.querySelector('.like-button');
                likeBtn.dataset.likeId = slideData.likeId;
                updateLikeButtonState(likeBtn, slideData.isLiked, slideData.initialLikes);

                const progressSlider = section.querySelector('.video-progress');
                VideoManager.initProgressBar(progressSlider, section.querySelector('.videoPlayer'));

                return section;
            }

            function renderSlides() {
                DOM.container.innerHTML = '';
                if (slidesData.length === 0) return;

                const addClone = (slideData, index, isFirst) => {
                    const clone = createSlideElement(slideData, index);
                    clone.dataset.isClone = 'true';
                    DOM.container.appendChild(clone);
                };

                addClone(slidesData[slidesData.length - 1], slidesData.length - 1, false);
                slidesData.forEach((data, index) => DOM.container.appendChild(createSlideElement(data, index)));
                addClone(slidesData[0], 0, true);
            }

            return {
                DOM,
                showAlert,
                openModal,
                closeModal,
                updateUIForLoginState,
                updateTranslations,
                applyLikeStateToDom,
                renderSlides
            };
        })();


        /**
         * ==========================================================================
         * 6. VIDEO MANAGER
         * ==========================================================================
         */
        const VideoManager = (function() {
            let hlsPromise = null;
            const hlsInstances = new Map();
            const attachedSet = new WeakSet();
            const retryCounts = new WeakMap();
            const hlsRecoverCounts = new Map();
            let playObserver, lazyObserver;

            window.TTStats = window.TTStats || { videoErrors: 0, videoRetries: 0, hlsErrors: 0, hlsRecovered: 0, ttfpSamples: 0, ttfpTotalMs: 0 };

            function _loadHlsLibrary() {
                if (window.Hls) return Promise.resolve();
                if (!hlsPromise) {
                    hlsPromise = import('https://cdn.jsdelivr.net/npm/hls.js@1.5.14/dist/hls.min.js')
                        .catch(err => {
                            console.error("Failed to load HLS.js", err);
                            hlsPromise = null;
                            throw err;
                        });
                }
                return hlsPromise;
            }

            function _guardedPlay(videoEl) {
                if ((Date.now() - State.get('lastUserGestureTimestamp')) < Config.GESTURE_GRACE_PERIOD_MS) {
                    const playPromise = videoEl.play();
                    if (playPromise) {
                        playPromise.catch(error => {
                            if (error.name === 'NotAllowedError') {
                                console.warn("Autoplay was blocked by the browser.", error);
                                State.set('isAutoplayBlocked', true);
                            }
                        });
                    }
                }
            }

            function _attachSrc(sectionEl) {
                const video = sectionEl.querySelector('.videoPlayer');
                if (!video || attachedSet.has(video)) return;
                const slideId = sectionEl.dataset.slideId;
                const slideData = slidesData.find(s => s.id === slideId);

                const canAttach = slideData && !(slideData.access === 'secret' && !State.get('isUserLoggedIn'));
                if (!canAttach) return;

                const setMp4Source = (mp4Url) => {
                    if (!mp4Url) return;
                    const finalUrl = Utils.toRelativeIfSameOrigin(Utils.fixProtocol(mp4Url));
                    const sourceEl = video.querySelector('source');
                    if (sourceEl) { sourceEl.src = finalUrl; sourceEl.type = 'video/mp4'; }
                    video.load();
                };

                if (Config.USE_HLS && slideData.hlsUrl) {
                    const finalHlsUrl = Utils.toRelativeIfSameOrigin(Utils.fixProtocol(slideData.hlsUrl));
                    if (video.canPlayType('application/vnd.apple.mpegurl')) {
                        const sourceEl = video.querySelector('source');
                        if(sourceEl) { sourceEl.src = finalHlsUrl; sourceEl.type = 'application/vnd.apple.mpegurl'; }
                        video.load();
                    } else {
                        _loadHlsLibrary().then(() => {
                            if (window.Hls?.isSupported()) {
                                if (hlsInstances.has(slideId)) hlsInstances.get(slideId).destroy();
                                const hls = new window.Hls(Config.HLS);
                                hls.loadSource(finalHlsUrl);
                                hls.attachMedia(video);
                                hls.on(window.Hls.Events.ERROR, (event, data) => {
                                    if (data.fatal) {
                                       hls.destroy(); hlsInstances.delete(slideId); setMp4Source(slideData.mp4Url);
                                    }
                                });
                                hlsInstances.set(slideId, hls);
                            } else {
                                setMp4Source(slideData.mp4Url);
                            }
                        }).catch(() => setMp4Source(slideData.mp4Url));
                    }
                } else {
                    setMp4Source(slideData.mp4Url);
                }

                attachedSet.add(video);
            }

            function _detachSrc(sectionEl) {
                const video = sectionEl.querySelector('.videoPlayer');
                if (!video) return;
                try { video.pause(); } catch(e) {}
                const slideId = sectionEl.dataset.slideId;
                if (slideId && hlsInstances.has(slideId)) {
                  try { hlsInstances.get(slideId).destroy(); } catch(e){}
                  hlsInstances.delete(slideId);
                }
                const sourceEl = video.querySelector('source');
                if (sourceEl) { sourceEl.removeAttribute('src'); }
                video.removeAttribute('src');
                video.load();
                attachedSet.delete(video);
            }

            function _startProgressUpdates(video) {
                _stopProgressUpdates(video);
                const session = State.get('activeVideoSession');
                const updateFn = () => {
                    if (session !== State.get('activeVideoSession') || !video.duration) return;
                    _updateProgressUI(video);
                    if (!video.paused) {
                        video.rAF_id = requestAnimationFrame(updateFn);
                    }
                };
                updateFn();
            }

            function _stopProgressUpdates(video) {
                if (video.rAF_id) cancelAnimationFrame(video.rAF_id);
            }

            function _updateProgressUI(video) {
                if (State.get('isDraggingProgress') || !video || !video.duration) return;
                const section = video.closest('.webyx-section');
                if (!section) return;
                const percent = (video.currentTime / video.duration) * 100;
                section.querySelector('.progress-line').style.width = `${percent}%`;
                section.querySelector('.progress-dot').style.left = `${percent}%`;
                section.querySelector('.video-progress').setAttribute('aria-valuenow', String(Math.round(percent)));
            };

            function _onActiveSlideChanged(newIndex, oldIndex = -1) {
                State.set('activeVideoSession', State.get('activeVideoSession') + 1);

                const allSections = UI.DOM.container.querySelectorAll('.webyx-section:not([data-is-clone="true"])');

                if (oldIndex > -1 && oldIndex < allSections.length) {
                    const oldSection = allSections[oldIndex];
                    const oldVideo = oldSection.querySelector('.videoPlayer');
                    if (oldVideo) { oldVideo.pause(); _stopProgressUpdates(oldVideo); }
                    oldSection.querySelector('.pause-icon')?.classList.remove('visible');
                    const progressLine = oldSection.querySelector('.progress-line');
                    const progressDot = oldSection.querySelector('.progress-dot');
                    if(progressLine && progressDot) {
                        progressLine.style.width = '0%';
                        progressDot.style.left = '0%';
                    }
                }

                if (newIndex < allSections.length) {
                    const newSection = allSections[newIndex];
                    const newVideo = newSection.querySelector('.videoPlayer');
                    const isSecret = newSection.querySelector('.tiktok-symulacja').dataset.access === 'secret';

                    if (!(isSecret && !State.get('isUserLoggedIn')) && !State.get('isAutoplayBlocked')) {
                        _guardedPlay(newVideo);
                    }
                    _startProgressUpdates(newVideo);
                }
            }

            function _initLazyObserver() {
                if (lazyObserver) return;
                lazyObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        const section = entry.target.closest('.webyx-section');
                        if (!section) return;
                        if (entry.isIntersecting) {
                            _attachSrc(section);
                        } else if (Config.UNLOAD_FAR_SLIDES) {
                            const index = parseInt(section.dataset.index, 10);
                            const distance = Math.abs(index - State.get('currentSlideIndex'));
                            if (distance > Config.FAR_DISTANCE) _detachSrc(section);
                        }
                    });
                }, { root: UI.DOM.container, rootMargin: Config.PREFETCH_MARGIN, threshold: 0.01 });
                UI.DOM.container.querySelectorAll('.webyx-section:not([data-is-clone="true"])').forEach(sec => lazyObserver.observe(sec));
            }

            return {
                init: () => {
                    _initLazyObserver();
                    playObserver = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const newIndex = parseInt(entry.target.dataset.index, 10);
                                if (newIndex !== State.get('currentSlideIndex')) {
                                    const oldIndex = State.get('currentSlideIndex');
                                    State.set('currentSlideIndex', newIndex);
                                    _onActiveSlideChanged(newIndex, oldIndex);
                                    UI.updateUIForLoginState();
                                }
                            }
                        });
                    }, { root: UI.DOM.container, threshold: 0.75 });

                    UI.DOM.container.querySelectorAll('.webyx-section:not([data-is-clone="true"])').forEach(section => playObserver.observe(section));
                },
                initProgressBar: (progressEl, videoEl) => {
                    if (!progressEl || !videoEl) return;
                    progressEl.classList.add('skeleton');
                    videoEl.addEventListener('loadedmetadata', () => progressEl.classList.remove('skeleton'), { once: true });

                    let pointerId = null;
                    const seek = (e) => {
                        const rect = progressEl.getBoundingClientRect();
                        const x = ('clientX' in e ? e.clientX : (e.touches?.[0]?.clientX || 0));
                        const percent = ((x - rect.left) / rect.width) * 100;
                        const clamped = Math.max(0, Math.min(100, percent));
                        if (videoEl.duration) videoEl.currentTime = (clamped / 100) * videoEl.duration;
                        _updateProgressUI(videoEl);
                    };

                    progressEl.addEventListener('pointerdown', (e) => {
                        if (pointerId !== null) return;
                        pointerId = e.pointerId;
                        State.set('isDraggingProgress', true);
                        progressEl.classList.add('dragging');
                        progressEl.setPointerCapture(pointerId);
                        seek(e);
                    });

                    progressEl.addEventListener('pointermove', (e) => {
                        if (e.pointerId !== pointerId) return;
                        seek(e);
                    });

                    const endDrag = (e) => {
                        if (e.pointerId !== pointerId) return;
                        pointerId = null;
                        State.set('isDraggingProgress', false);
                        progressEl.classList.remove('dragging');
                        _startProgressUpdates(videoEl);
                    };
                    progressEl.addEventListener('pointerup', endDrag);
                    progressEl.addEventListener('pointercancel', endDrag);

                    progressEl.addEventListener('keydown', (e) => {
                        if (!videoEl.duration) return;
                        const step = videoEl.duration * 0.05;
                        switch (e.key) {
                            case 'ArrowLeft': videoEl.currentTime -= step; break;
                            case 'ArrowRight': videoEl.currentTime += step; break;
                            default: return;
                        }
                        e.preventDefault();
                    });
                },
                updatePlaybackForLoginChange: (section, isSecret) => {
                    const video = section.querySelector('.videoPlayer');
                    const hasSrc = video.querySelector('source')?.getAttribute('src');

                    if (!isSecret && !hasSrc) _attachSrc(section);

                    if (isSecret) {
                        video.pause();
                        _stopProgressUpdates(video);
                        video.currentTime = 0;
                        _updateProgressUI(video);
                    } else if (video.paused && document.body.classList.contains('loaded') && !State.get('isDraggingProgress') && !State.get('isAutoplayBlocked')) {
                       _guardedPlay(video);
                    }
                },
                handleVideoClick: (video) => {
                    if (State.get('isDraggingProgress')) return;
                    const pauseIcon = video.closest('.webyx-section')?.querySelector('.pause-icon');
                    if (video.paused) {
                        _guardedPlay(video);
                        pauseIcon?.classList.remove('visible');
                    } else {
                        video.pause();
                        pauseIcon?.classList.add('visible');
                    }
                },
            };
        })();

        /**
         * ==========================================================================
         * 7. EVENT HANDLERS & NOTIFICATIONS
         * ==========================================================================
         */
        const Handlers = (function() {
            function handleNotificationClick(event) {
                const item = event.target.closest('.notification-item');
                if (!item) return;

                item.classList.toggle('expanded');
                item.setAttribute('aria-expanded', item.classList.contains('expanded'));

                if (item.classList.contains('unread')) {
                    item.classList.remove('unread');
                }
            }

            async function handleLogin(form) {
                const submitButton = form.querySelector('input[type="submit"]');
                submitButton.disabled = true;
                try {
                    const data = Object.fromEntries(new FormData(form).entries());
                    const json = await API.login(data);
                    if (json.success) {
                        State.set('isUserLoggedIn', true);
                        UI.showAlert(Utils.getTranslation('loginSuccess'));
                        await API.refreshNonce();
                        App.fetchAndUpdateSlideData();
                        UI.updateUIForLoginState();
                    } else {
                        UI.showAlert(json.data?.message || Utils.getTranslation('loginFailed'), true);
                    }
                } finally {
                    submitButton.disabled = false;
                }
            }

            async function handleLogout(link) {
                if (link.disabled) return;
                link.disabled = true;
                const json = await API.logout();
                if (json.success) {
                    State.set('isUserLoggedIn', false);
                    UI.showAlert(Utils.getTranslation('logoutSuccess'));
                    slidesData.forEach(slide => slide.isLiked = false);
                    await API.refreshNonce();
                    UI.updateUIForLoginState();
                } else {
                    UI.showAlert(json.data?.message || 'Logout failed.', true);
                }
                link.disabled = false;
            }

            async function handleLikeToggle(button) {
                if (!State.get('isUserLoggedIn')) {
                    Utils.vibrateTry();
                    UI.showAlert(Utils.getTranslation('likeAlert'));
                    return;
                }
                const slideId = button.closest('.webyx-section')?.dataset.slideId;
                const slideData = slidesData.find(s => s.id === slideId);
                if (!slideData) return;

                const isCurrentlyLiked = !!slideData.isLiked;
                const newLikedState = !isCurrentlyLiked;
                const currentCount = slideData.initialLikes;
                const newCount = newLikedState ? currentCount + 1 : Math.max(0, currentCount - 1);

                // Optimistic UI update
                slideData.isLiked = newLikedState;
                slideData.initialLikes = newCount;
                UI.applyLikeStateToDom(slideData.likeId, newLikedState, newCount);
                button.disabled = true;

                const json = await API.toggleLike(slideData.likeId);

                if (json.success) {
                    slideData.isLiked = json.data.status === 'liked';
                    slideData.initialLikes = json.data.count;
                    UI.applyLikeStateToDom(slideData.likeId, slideData.isLiked, slideData.initialLikes);
                } else {
                    // Revert
                    slideData.isLiked = isCurrentlyLiked;
                    slideData.initialLikes = currentCount;
                    UI.applyLikeStateToDom(slideData.likeId, isCurrentlyLiked, currentCount);
                    UI.showAlert(json.data?.message || Utils.getTranslation('likeError'), true);
                }
                button.disabled = false;
            }

            function handleShare(button) {
                const section = button.closest('.webyx-section');
                const slideData = slidesData.find(s => s.id === section.dataset.slideId);
                if (navigator.share && slideData) {
                    navigator.share({
                        title: Utils.getTranslation('shareTitle'),
                        text: slideData.description,
                        url: window.location.href,
                    }).catch(err => { if (err.name !== 'AbortError') console.error('Share error:', err); });
                } else {
                    navigator.clipboard.writeText(window.location.href).then(() => UI.showAlert(Utils.getTranslation('linkCopied')));
                }
            }

            function handleLanguageToggle() {
                const newLang = State.get('currentLang') === 'pl' ? 'en' : 'pl';
                State.set('currentLang', newLang);
                localStorage.setItem('tt_lang', newLang);
                UI.updateTranslations();
                Notifications.render();
            }

            return {
                handleNotificationClick,
                mainClickHandler: (e) => {
                    const target = e.target;
                    const actionTarget = target.closest('[data-action]');
                    if (!actionTarget) {
                        if (target.closest('.videoPlayer')) VideoManager.handleVideoClick(target.closest('.videoPlayer'));
                        return;
                    }

                    const action = actionTarget.dataset.action;
                    const section = actionTarget.closest('.webyx-section');

                    switch (action) {
                        case 'toggle-like': handleLikeToggle(actionTarget); break;
                        case 'share': handleShare(actionTarget); break;
                        case 'toggle-language': handleLanguageToggle(); break;
                        case 'open-comments-modal': UI.openModal(UI.DOM.commentsModal); break;
                        case 'open-info-modal': UI.openModal(UI.DOM.infoModal); break;
                        case 'open-account-modal':
                            if(section) section.querySelector('.logged-in-menu').classList.remove('active');
                            AccountPanel.openAccountModal();
                            break;
                        case 'close-account-modal':
                            AccountPanel.closeAccountModal();
                            break;
                        case 'logout': e.preventDefault(); handleLogout(actionTarget); break;
                        case 'toggle-main-menu':
                            if (State.get('isUserLoggedIn')) {
                                section.querySelector('.logged-in-menu').classList.toggle('active');
                            } else {
                                Utils.vibrateTry();
                                UI.showAlert(Utils.getTranslation('menuAccessAlert'));
                            }
                            break;
                        case 'toggle-login-panel':
                            if (!State.get('isUserLoggedIn')) {
                                section.querySelector('.login-panel').classList.toggle('active');
                                section.querySelector('.topbar').classList.toggle('login-panel-active');
                            }
                            break;
                        case 'subscribe':
                            if (!State.get('isUserLoggedIn')) {
                                Utils.vibrateTry(); UI.showAlert(Utils.getTranslation('subscribeAlert'));
                            }
                            break;
                        case 'toggle-notifications':
                            if (State.get('isUserLoggedIn')) {
                                const popup = UI.DOM.notificationPopup;
                                popup.classList.toggle('visible');
                                if(popup.classList.contains('visible')) Notifications.render();
                            } else {
                                Utils.vibrateTry();
                                UI.showAlert(Utils.getTranslation('notificationAlert'));
                            }
                            break;
                        case 'close-notifications':
                            if (UI.DOM.notificationPopup) {
                                UI.DOM.notificationPopup.classList.remove('visible');
                            }
                            break;
                        case 'show-tip-jar': document.querySelector('#bmc-wbtn')?.click(); break;
                    }
                },
                formSubmitHandler: (e) => {
                    const form = e.target.closest('form.login-form');
                    if (form) { e.preventDefault(); handleLogin(form); }
                }
            };
        })();

        const Notifications = (function() {
            const mockData = [
                { id: 1, type: 'message', previewKey: 'notif1Preview', timeKey: 'notif1Time', fullKey: 'notif1Full', unread: true },
                { id: 2, type: 'profile', previewKey: 'notif2Preview', timeKey: 'notif2Time', fullKey: 'notif2Full', unread: true },
                { id: 3, type: 'offer', previewKey: 'notif3Preview', timeKey: 'notif3Time', fullKey: 'notif3Full', unread: false },
            ];

            const icons = {
                message: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>`,
                profile: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>`,
                offer: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" /></svg>`
            };

            return {
                render: () => {
                    const listEl = UI.DOM.notificationPopup.querySelector('.notification-list');
                    const emptyStateEl = UI.DOM.notificationPopup.querySelector('.notification-empty-state');
                    listEl.innerHTML = '';
                    listEl.appendChild(emptyStateEl);

                    if (mockData.length === 0) {
                        emptyStateEl.classList.remove('hidden-by-js');
                        return;
                    }

                    emptyStateEl.classList.add('hidden-by-js');
                    const fragment = document.createDocumentFragment();

                    mockData.forEach(notif => {
                        const item = document.createElement('li');
                        item.className = `notification-item ${notif.unread ? 'unread' : ''}`;
                        item.setAttribute('role', 'button');
                        item.setAttribute('tabindex', '0');
                        item.setAttribute('aria-expanded', 'false');

                        item.innerHTML = `
                            <div class="notif-header">
                                <div class="notif-icon" aria-hidden="true">${icons[notif.type] || ''}</div>
                                <div class="notif-content-wrapper">
                                    <div class="notif-summary">
                                        <span class="notif-preview">${Utils.getTranslation(notif.previewKey)}</span>
                                        <span class="notif-time">${Utils.getTranslation(notif.timeKey)}</span>
                                    </div>
                                    <div class="unread-dot"></div>
                                    <svg class="expand-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                                </div>
                            </div>
                            <div class="notif-full-details">
                                ${Utils.getTranslation(notif.fullKey)}
                            </div>
                        `;
                        fragment.appendChild(item);
                    });
                    listEl.appendChild(fragment);
                }
            }
        })();


        /**
         * ==========================================================================
         * 8. ACCOUNT PANEL
         * ==========================================================================
         */
        const AccountPanel = (function(){
            // Global variables for the panel
            let cropImage = null;
            let cropCanvas = null;
            let cropCtx = null;
            let scale = 1;
            let offsetX = 0;
            let offsetY = 0;
            let isDragging = false;
            let lastX = 0;
            let lastY = 0;
            let minScale = 1;
            let maxScale = 3;

            // Global state for settings
            let userSettings = {
                emailConsent: true,
                emailLanguage: 'pl'
            };

            // Main initialization function
            function init() {
                initializeModal();
                initializeCropper();
                setupEventListeners();
                loadUserSettings();
            }

            // Load user settings - MOCK
            async function loadUserSettings() {
                try {
                    // MOCK - simulating settings load
                    await new Promise(resolve => setTimeout(resolve, 500));
                    userSettings = { emailConsent: true, emailLanguage: 'pl' };
                    updateSettingsUI();
                } catch (error) {
                    console.log('Could not load settings:', error);
                }
            }

            function updateSettingsUI() {
                const consentToggle = document.getElementById('emailConsent');
                if (userSettings.emailConsent) {
                    consentToggle.classList.add('active');
                } else {
                    consentToggle.classList.remove('active');
                }
                document.querySelectorAll('.language-option').forEach(option => {
                    option.classList.remove('active');
                    if (option.dataset.lang === userSettings.emailLanguage) {
                        option.classList.add('active');
                    }
                });
            }

            // Settings handlers
            function toggleEmailConsent() {
                userSettings.emailConsent = !userSettings.emailConsent;
                updateSettingsUI();
            }

            function selectLanguage(lang) {
                userSettings.emailLanguage = lang;
                updateSettingsUI();
            }

            async function saveSettings() {
                const button = document.getElementById('saveSettingsBtn');
                const originalText = button.textContent;
                try {
                    button.disabled = true;
                    button.innerHTML = '<span class="loading-spinner"></span> Zapisywanie...';
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    showSuccess('settingsSuccess', 'Ustawienia zostały zapisane! (DEMO)');
                } catch (error) {
                    showError('settingsError', error.message);
                } finally {
                    button.disabled = false;
                    button.textContent = originalText;
                }
            }

            // Profile data functions
            async function loadInitialProfileData() {
                try {
                    const result = await loadUserProfile();
                    if (result.success) {
                        populateProfileForm(result.data);
                    } else {
                        throw new Error(result.data?.message || 'Nie udało się załadować profilu');
                    }
                } catch (error) {
                    console.log('Could not load profile data:', error);
                    showError('profileError', 'Nie można załadować danych profilu.');
                }
            }

            function populateProfileForm(data) {
                if (data.first_name) document.getElementById('firstName').value = data.first_name;
                if (data.last_name) document.getElementById('lastName').value = data.last_name;
                if (data.email) document.getElementById('email').value = data.email;
                if (data.display_name) document.getElementById('displayName').textContent = data.display_name;
                if (data.email) document.getElementById('userEmail').textContent = data.email;
                if (data.avatar) document.getElementById('userAvatar').src = data.avatar;
            }

            // Modal visibility functions
            function openAccountModal() {
                const modal = document.getElementById('accountModal');
                modal.classList.add('visible');
                document.body.style.overflow = 'hidden';
                loadInitialProfileData(); // Fetch live data when opening
            }

            function closeAccountModal() {
                const modal = document.getElementById('accountModal');
                modal.classList.remove('visible');
                document.body.style.overflow = '';
            }

            // Tab switching
            function initializeModal() {
                const tabButtons = document.querySelectorAll('.account-tabs .tab-btn');
                const tabPanes = document.querySelectorAll('.account-content .tab-pane');

                tabButtons.forEach(button => {
                    button.addEventListener('click', () => {
                        const targetTab = button.dataset.tab;
                        tabButtons.forEach(btn => btn.classList.remove('active'));
                        button.classList.add('active');
                        tabPanes.forEach(pane => pane.classList.remove('active'));
                        document.getElementById(targetTab + '-tab').classList.add('active');
                        document.querySelector('.account-header h2').textContent = button.textContent;
                    });
                });
            }

            // Event Listeners setup
            function setupEventListeners() {
                document.getElementById('avatarFileInput').addEventListener('change', handleFileSelect);
                document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
                document.getElementById('passwordForm').addEventListener('submit', handlePasswordSubmit);
                document.getElementById('deleteForm').addEventListener('submit', handleDeleteSubmit);

                document.getElementById('avatarEditBtn').addEventListener('click', () => document.getElementById('avatarFileInput').click());
                document.getElementById('emailConsent').addEventListener('click', toggleEmailConsent);
                document.querySelectorAll('.language-option').forEach(el => el.addEventListener('click', () => selectLanguage(el.dataset.lang)));
                document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

                const deleteInput = document.getElementById('deleteConfirmation');
                const deleteBtn = document.getElementById('deleteAccountBtn');
                deleteInput.addEventListener('input', function() {
                    deleteBtn.disabled = this.value.trim() !== 'USUWAM KONTO';
                });

                document.getElementById('zoomSlider').addEventListener('input', function() {
                    scale = parseFloat(this.value);
                    drawCropCanvas();
                });

                document.getElementById('cropCloseBtn').addEventListener('click', closeCropModal);
                document.getElementById('zoomInBtn').addEventListener('click', () => adjustZoom(0.1));
                document.getElementById('zoomOutBtn').addEventListener('click', () => adjustZoom(-0.1));
                document.getElementById('cropSaveBtn').addEventListener('click', cropAndSave);

                document.addEventListener('keydown', function(event) {
                    if (event.key === 'Escape') {
                        if (document.getElementById('cropModal').classList.contains('visible')) {
                            closeCropModal();
                        } else if (document.getElementById('accountModal').classList.contains('visible')) {
                            closeAccountModal();
                        }
                    }
                });
            }

            function handleFileSelect(event) {
                const file = event.target.files[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) return showError('profileError', 'Proszę wybrać plik obrazu.');
                if (file.size > 5 * 1024 * 1024) return showError('profileError', 'Plik jest za duży. Maksymalny rozmiar to 5MB.');

                const reader = new FileReader();
                reader.onload = function(e) {
                    cropImage = new Image();
                    cropImage.onload = function() {
                        openCropModal();
                        initializeCropCanvas();
                    };
                    cropImage.src = e.target.result;
                };
                reader.readAsDataURL(file);
            }

            function openCropModal() { document.getElementById('cropModal').classList.add('visible'); }
            function closeCropModal() { document.getElementById('cropModal').classList.remove('visible'); cropImage = null; }

            function initializeCropper() {
                cropCanvas = document.getElementById('cropCanvas');
                cropCtx = cropCanvas.getContext('2d');
                cropCanvas.addEventListener('mousedown', startDrag);
                cropCanvas.addEventListener('mousemove', drag);
                window.addEventListener('mouseup', endDrag);
                cropCanvas.addEventListener('mouseleave', endDrag);
                cropCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
                cropCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
                window.addEventListener('touchend', endDrag);
            }

            function initializeCropCanvas() {
                if (!cropImage) return;
                const canvasRect = cropCanvas.getBoundingClientRect();
                cropCanvas.width = canvasRect.width;
                cropCanvas.height = canvasRect.height;

                const cropCircleSize = Math.min(cropCanvas.width, cropCanvas.height) * 0.8;
                const imageMaxDimension = Math.max(cropImage.width, cropImage.height);

                minScale = cropCircleSize / imageMaxDimension;
                scale = minScale;
                offsetX = 0;
                offsetY = 0;

                const slider = document.getElementById('zoomSlider');
                slider.min = minScale.toFixed(2);
                slider.max = (minScale * 4).toFixed(2);
                slider.value = scale.toFixed(2);
                maxScale = minScale * 4;

                drawCropCanvas();
            }

            function drawCropCanvas() {
                if (!cropImage || !cropCtx) return;
                const canvas = cropCanvas;
                const ctx = cropCtx;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const imgWidth = cropImage.width * scale;
                const imgHeight = cropImage.height * scale;
                const x = (canvas.width - imgWidth) / 2 + offsetX;
                const y = (canvas.height - imgHeight) / 2 + offsetY;
                ctx.drawImage(cropImage, x, y, imgWidth, imgHeight);
            }

            function startDrag(event) { isDragging = true; lastX = event.clientX; lastY = event.clientY; cropCanvas.style.cursor = 'grabbing'; }
            function drag(event) { if (!isDragging) return; const deltaX = event.clientX - lastX; const deltaY = event.clientY - lastY; offsetX += deltaX; offsetY += deltaY; lastX = event.clientX; lastY = event.clientY; constrainOffsets(); drawCropCanvas(); }
            function endDrag() { isDragging = false; cropCanvas.style.cursor = 'grab'; }
            function handleTouchStart(event) { event.preventDefault(); if (event.touches.length === 1) { const touch = event.touches[0]; startDrag({ clientX: touch.clientX, clientY: touch.clientY }); } }
            function handleTouchMove(event) { event.preventDefault(); if (event.touches.length === 1 && isDragging) { const touch = event.touches[0]; drag({ clientX: touch.clientX, clientY: touch.clientY }); } }
            function adjustZoom(delta) { const newScale = Math.max(minScale, Math.min(maxScale, scale + delta)); scale = newScale; document.getElementById('zoomSlider').value = scale; constrainOffsets(); drawCropCanvas(); }
            function constrainOffsets() { if (!cropImage) return; const imgWidth = cropImage.width * scale; const imgHeight = cropImage.height * scale; const maxOffsetX = Math.max(0, (imgWidth - cropCanvas.width) / 2); const maxOffsetY = Math.max(0, (imgHeight - cropCanvas.height) / 2); offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX)); offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY)); }

            async function cropAndSave() {
                if (!cropImage) return;
                const button = document.getElementById('cropSaveBtn');
                const originalHTML = button.innerHTML;
                button.disabled = true;
                button.innerHTML = '<span class="loading-spinner"></span> Zapisywanie...';

                try {
                    const outputCanvas = document.createElement('canvas');
                    outputCanvas.width = 200;
                    outputCanvas.height = 200;
                    const outputCtx = outputCanvas.getContext('2d');

                    const cropSize = Math.min(cropCanvas.width, cropCanvas.height) * 0.8;
                    const srcSize = cropSize / scale;
                    const srcX = (cropImage.width - srcSize) / 2 - (offsetX / scale);
                    const srcY = (cropImage.height - srcSize) / 2 - (offsetY / scale);

                    outputCtx.drawImage(cropImage, srcX, srcY, srcSize, srcSize, 0, 0, 200, 200);

                    const dataUrl = outputCanvas.toDataURL('image/png', 0.9);
                    const result = await uploadAvatar(dataUrl);

                    if (result.success && result.data?.url) {
                        const newAvatarUrl = result.data.url + '?t=' + Date.now();
                        document.getElementById('userAvatar').src = newAvatarUrl;
                        document.querySelectorAll('.profile img, .tiktok-symulacja .profile img').forEach(img => { img.src = newAvatarUrl; });
                        showSuccess('profileSuccess', 'Avatar został zaktualizowany!');
                        closeCropModal();
                        document.dispatchEvent(new CustomEvent('tt:avatar-updated', { detail: { url: newAvatarUrl } }));
                    } else {
                        throw new Error(result.data?.message || 'Nie otrzymano URL avatara');
                    }
                } catch (error) {
                    showError('profileError', error.message || 'Błąd podczas przetwarzania obrazu.');
                } finally {
                    button.disabled = false;
                    button.innerHTML = originalHTML;
                }
            }

            async function apiRequest(action, data = {}) {
                const body = new URLSearchParams({ action, nonce: ajax_object.nonce });
                for(const key in data) { body.append(key, data[key]); }
                try {
                    const response = await fetch(ajax_object.ajax_url, { method: 'POST', body, credentials: 'same-origin' });
                    if (!response.ok) throw new Error(`Błąd serwera: ${response.status}`);
                    const result = await response.json();
                    if (result.new_nonce) ajax_object.nonce = result.new_nonce;
                    return result;
                } catch (error) {
                    console.error(`Błąd API dla akcji "${action}":`, error);
                    return { success: false, data: { message: error.message } };
                }
            }
            async function uploadAvatar(dataUrl) { return apiRequest('tt_avatar_upload', { image: dataUrl }); }
            async function updateProfile(data) { return apiRequest('tt_profile_update', data); }
            async function changePassword(data) { return apiRequest('tt_password_change', data); }
            async function deleteAccount(confirmText) { return apiRequest('tt_account_delete', { confirm_text: confirmText }); }
            async function loadUserProfile() { return apiRequest('tt_profile_get'); }

            async function handleProfileSubmit(event) {
                event.preventDefault();
                const button = document.getElementById('saveProfileBtn');
                const originalText = button.textContent;
                button.disabled = true;
                button.innerHTML = '<span class="loading-spinner"></span> Zapisywanie...';
                try {
                    const data = { first_name: document.getElementById('firstName').value.trim(), last_name: document.getElementById('lastName').value.trim(), email: document.getElementById('email').value.trim() };
                    if (!data.first_name || !data.last_name || !data.email) throw new Error('Wszystkie pola są wymagane.');
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('Podaj prawidłowy adres email.');
                    const result = await updateProfile(data);
                    if (result.success) {
                        showSuccess('profileSuccess', 'Profil został zaktualizowany!');
                        populateProfileForm(result.data);
                    } else { throw new Error(result.data?.message || 'Błąd aktualizacji profilu.'); }
                } catch (error) {
                    showError('profileError', error.message);
                } finally {
                    button.disabled = false;
                    button.textContent = originalText;
                }
            }

            async function handlePasswordSubmit(event) {
                event.preventDefault();
                const button = document.getElementById('changePasswordBtn');
                const originalText = button.textContent;
                button.disabled = true;
                button.innerHTML = '<span class="loading-spinner"></span> Zmienianie...';
                try {
                    const currentPassword = document.getElementById('currentPassword').value, newPassword = document.getElementById('newPassword').value, confirmPassword = document.getElementById('confirmPassword').value;
                    if (!currentPassword || !newPassword || !confirmPassword) throw new Error('Wszystkie pola są wymagane.');
                    if (newPassword.length < 8) throw new Error('Nowe hasło musi mieć minimum 8 znaków.');
                    if (newPassword !== confirmPassword) throw new Error('Nowe hasła muszą być identyczne.');
                    const result = await changePassword({ current_password: currentPassword, new_password_1: newPassword, new_password_2: confirmPassword });
                    if (result.success) {
                        showSuccess('passwordSuccess', 'Hasło zostało zmienione!');
                        document.getElementById('passwordForm').reset();
                    } else { throw new Error(result.data?.message || 'Błąd zmiany hasła.'); }
                } catch (error) {
                    showError('passwordError', error.message);
                } finally {
                    button.disabled = false;
                    button.textContent = originalText;
                }
            }

            async function handleDeleteSubmit(event) {
                event.preventDefault();
                const button = document.getElementById('deleteAccountBtn');
                const originalText = button.textContent;
                button.disabled = true;
                button.innerHTML = '<span class="loading-spinner"></span> Usuwanie...';
                try {
                    const confirmText = document.getElementById('deleteConfirmation').value;
                    if (confirmText.trim() !== 'USUWAM KONTO') throw new Error('Wpisz dokładnie: USUWAM KONTO');
                    const result = await deleteAccount(confirmText);
                    if (result.success) {
                        showSuccess('deleteSuccess', 'Konto zostało usunięte. Trwa wylogowywanie...');
                        setTimeout(() => window.location.reload(), 2000);
                    } else { throw new Error(result.data?.message || 'Błąd usuwania konta.'); }
                } catch (error) {
                    showError('deleteError', error.message);
                    if(!document.getElementById('deleteSuccess').classList.contains('show')) {
                      button.disabled = false;
                      button.textContent = originalText;
                    }
                }
            }

            function hideAllMessages() { document.querySelectorAll('.status-message').forEach(el => { el.classList.remove('show'); el.style.display = 'none'; }); }
            function showSuccess(elementId, message) { hideAllMessages(); const el = document.getElementById(elementId); el.textContent = message; el.style.display = 'block'; requestAnimationFrame(() => el.classList.add('show')); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.style.display = 'none', 300); }, 3000); }
            function showError(elementId, message) { hideAllMessages(); const el = document.getElementById(elementId); el.textContent = message; el.style.display = 'block'; requestAnimationFrame(() => el.classList.add('show')); setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.style.display = 'none', 300); }, 4000); }

            return { init, openAccountModal, closeAccountModal };
        })();

        /**
         * ==========================================================================
         * 9. APP INITIALIZATION
         * ==========================================================================
         */
        const App = (function() {
            function _initializeGlobalListeners() {
                Utils.setAppHeightVar();
                window.addEventListener('resize', Utils.setAppHeightVar);
                window.addEventListener('orientationchange', Utils.setAppHeightVar);

                ['touchstart', 'pointerdown', 'click', 'keydown'].forEach(evt => {
                    document.addEventListener(evt, Utils.recordUserGesture, { passive: true });
                });

                document.body.addEventListener('click', Handlers.mainClickHandler);
                UI.DOM.container.addEventListener('submit', Handlers.formSubmitHandler);

                document.querySelectorAll('.modal-overlay:not(#accountModal)').forEach(modal => {
                    modal.addEventListener('click', (e) => { if (e.target === modal) UI.closeModal(modal); });
                    modal.querySelector('.modal-close-btn, .topbar-close-btn')?.addEventListener('click', () => UI.closeModal(modal));
                });

                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        const visibleModal = document.querySelector('.modal-overlay.visible:not(#accountModal):not(#cropModal)');
                        if(visibleModal) UI.closeModal(visibleModal);
                        if(UI.DOM.notificationPopup.classList.contains('visible')) UI.DOM.notificationPopup.classList.remove('visible');
                    }
                });

                document.addEventListener('click', (event) => {
                    const popup = UI.DOM.notificationPopup;
                    if (popup && popup.classList.contains('visible') &&
                        !popup.contains(event.target) &&
                        !event.target.closest('[data-action="toggle-notifications"]')) {
                        popup.classList.remove('visible');
                    }
                });

                UI.DOM.notificationPopup.querySelector('.notification-list').addEventListener('click', Handlers.handleNotificationClick);
            }

            async function _fetchAndUpdateSlideData() {
                const json = await API.fetchSlidesData();
                if (json.success && Array.isArray(json.data)) {
                    const newDataMap = new Map(json.data.map(item => [String(item.likeId), item]));
                    slidesData.forEach(existingSlide => {
                        const updatedInfo = newDataMap.get(String(existingSlide.likeId));
                        if (updatedInfo) {
                            existingSlide.isLiked = updatedInfo.isLiked;
                            existingSlide.initialLikes = updatedInfo.initialLikes;
                            UI.applyLikeStateToDom(existingSlide.likeId, existingSlide.isLiked, existingSlide.initialLikes);
                        }
                    });
                }
            }

            function _startApp(selectedLang) {
                State.set('currentLang', selectedLang);
                localStorage.setItem('tt_lang', selectedLang);

                UI.renderSlides();
                UI.updateTranslations();
                VideoManager.init();

                setTimeout(() => {
                    UI.DOM.preloader.classList.add('preloader-hiding');
                    UI.DOM.container.classList.add('ready');
                    UI.DOM.preloader.addEventListener('transitionend', () => UI.DOM.preloader.style.display = 'none', { once: true });
                }, 1000);

                if (slidesData.length > 0) {
                    const viewHeight = window.innerHeight;
                    UI.DOM.container.classList.add('no-transition');
                    UI.DOM.container.scrollTo({ top: viewHeight, behavior: 'auto' });
                    requestAnimationFrame(() => {
                        UI.DOM.container.classList.remove('no-transition');
                        UI.DOM.container.addEventListener('scroll', () => {
                            clearTimeout(window.scrollEndTimeout);
                            window.scrollEndTimeout = setTimeout(() => {
                                const physicalIndex = Math.round(UI.DOM.container.scrollTop / viewHeight);
                                if (physicalIndex === 0) {
                                    UI.DOM.container.classList.add('no-transition');
                                    UI.DOM.container.scrollTop = slidesData.length * viewHeight;
                                    requestAnimationFrame(() => UI.DOM.container.classList.remove('no-transition'));
                                } else if (physicalIndex === slidesData.length + 1) {
                                    UI.DOM.container.classList.add('no-transition');
                                    UI.DOM.container.scrollTop = viewHeight;
                                    requestAnimationFrame(() => UI.DOM.container.classList.remove('no-transition'));
                                }
                            }, 50);
                        }, { passive: true });
                    });
                }
            }

            function _initializePreloader() {
                setTimeout(() => UI.DOM.preloader.classList.add('content-visible'), 500);
                UI.DOM.preloader.querySelectorAll('.language-selection button').forEach(button => {
                    button.addEventListener('click', () => {
                        UI.DOM.preloader.querySelectorAll('.language-selection button').forEach(btn => btn.disabled = true);
                        button.classList.add('is-selected');
                        setTimeout(() => _startApp(button.dataset.lang), 300);
                    }, { once: true });
                });
            }

            function _setInitialConfig() {
                try {
                    const c = navigator.connection || navigator.webkitConnection;
                    if (c?.saveData) Config.LOW_DATA_MODE = true;
                    if (c?.effectiveType?.includes('2g')) Config.LOW_DATA_MODE = true;
                    if (c?.effectiveType?.includes('3g')) Config.HLS.maxAutoLevelCapping = 480;
                } catch(_) {}
            }

            return {
                init: () => {
                    _setInitialConfig();
                    _initializeGlobalListeners();
                    AccountPanel.init();
                    _initializePreloader();
                    document.body.classList.add('loaded');
                },
                fetchAndUpdateSlideData: _fetchAndUpdateSlideData,
            };
        })();

        App.init();
    });
