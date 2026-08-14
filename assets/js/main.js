
(function () {
    'use strict';

    /* ==========================================================
       Constants
       ========================================================== */
    // Wide / No Ball sub-run options. "Wicket" is always shown here for the
    // scorer to tap if that's what physically happened on the delivery - but
    // whether it actually counts is decided by resolveExtra() based on
    // whether the ball is a No Ball and/or an active Free Hit is in play
    // (see `blockWicket` at the call site). Run Out always counts regardless.
    var EXTRA_OPTIONS = [
        { label: 'Dot', value: 0 },
        { label: '1 Run', value: 1 },
        { label: '2 Runs', value: 2 },
        { label: '3 Runs', value: 3 },
        { label: '4 Runs', value: 4 },
        { label: '6 Runs', value: 6 },
        { label: 'Wicket', value: 'W', danger: true },
        { label: 'Run Out', value: 'RO', danger: true }
    ];
    var RUNOUT_OPTIONS = [
        { label: 'Dot', value: 0 },
        { label: '1 Run', value: 1 },
        { label: '2 Runs', value: 2 },
        { label: '3 Runs', value: 3 }
    ];

    /* ==========================================================
       State
       ========================================================== */
    var state = null;

    function freshTeamScore(name) {
        return { name: name, runs: 0, wickets: 0, legalBalls: 0, extras: 0, currentChips: [], overHistory: [] };
    }

    function newMatchState() {
        return {
            config: { overs: 20, wickets: 10 },
            teams: { A: freshTeamScore('Team A'), B: freshTeamScore('Team B') },
            order: null,        // [firstBattingKey, secondBattingKey]
            innings: 1,
            target: null,
            matchOver: false,
            tossWinnerKey: null,
            freeHit: false      // true when the NEXT delivery is protected by a Free Hit
        };
    }

    /* ==========================================================
       DOM helpers
       ========================================================== */
    function el(id) { return document.getElementById(id); }

    /* ==========================================================
       Theme (light / dark)
       Defaults to the OS-level preference, then the toggle can
       override it for the rest of this session (not persisted -
       matches the app's "state lives in memory only" design).
       ========================================================== */
    function systemPrefersLight() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    }
    var currentTheme = systemPrefersLight() ? 'light' : 'dark';

    function applyTheme(theme) {
        currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        el('theme-toggle-icon').textContent = theme === 'light' ? '☀️' : '🌙';
        el('theme-toggle').setAttribute('aria-label', 'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' mode');
        var metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) metaTheme.setAttribute('content', theme === 'light' ? '#EAF4FF' : '#0A1522');
    }
    applyTheme(currentTheme);

    el('theme-toggle').addEventListener('click', function () {
        applyTheme(currentTheme === 'light' ? 'dark' : 'light');
    });

    var screens = { setup: el('screen-setup'), toss: el('screen-toss'), match: el('screen-match') };
    function showScreen(name) {
        Object.keys(screens).forEach(function (k) { screens[k].classList.remove('active'); });
        screens[name].classList.add('active');
    }

    function openModal(id) { el(id).classList.add('open'); }
    function closeModal(id) { el(id).classList.remove('open'); }

    var toastTimer = null;
    function showToast(msg) {
        var toast = el('toast');
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
    }

    function initials(name) {
        var parts = name.trim().split(/\s+/).map(function (w) { return w[0]; }).join('');
        return (parts.slice(0, 3) || '?').toUpperCase();
    }

    /* ==========================================================
       Setup screen
       ========================================================== */
    el('overs-quick').addEventListener('click', function (e) {
        var btn = e.target.closest('.quick-chip');
        if (!btn) return;
        el('input-overs').value = btn.dataset.overs;
        Array.prototype.forEach.call(el('overs-quick').children, function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
    });
    el('wkts-quick').addEventListener('click', function (e) {
        var btn = e.target.closest('.quick-chip');
        if (!btn) return;
        el('input-wickets').value = btn.dataset.wkts;
        Array.prototype.forEach.call(el('wkts-quick').children, function (c) { c.classList.remove('active'); });
        btn.classList.add('active');
    });

    el('btn-to-toss').addEventListener('click', function () {
        state = newMatchState();
        var nameA = el('input-teamA').value.trim() || 'Team A';
        var nameB = el('input-teamB').value.trim() || 'Team B';
        var overs = parseInt(el('input-overs').value, 10); if (!overs || overs < 1) overs = 20;
        var wkts = parseInt(el('input-wickets').value, 10); if (!wkts || wkts < 1) wkts = 10;

        state.teams.A.name = nameA;
        state.teams.B.name = nameB;
        state.config.overs = overs;
        state.config.wickets = wkts;

        setupToss();
        showScreen('toss');
    });

    /* ==========================================================
       Toss screen
       ========================================================== */
    function setupToss() {
        el('coin-heads-label').textContent = initials(state.teams.A.name);
        el('coin-tails-label').textContent = initials(state.teams.B.name);
        el('toss-result').classList.add('hidden');
        el('btn-flip').disabled = false;
        el('btn-flip').style.display = '';
        var coin = el('coin');
        coin.style.transition = 'none';
        coin.style.transform = 'rotateY(0deg)';
        void coin.offsetWidth; /* force reflow so the next transition applies cleanly */
        coin.style.transition = '';
    }

    // Uses the Web Crypto RNG when available (uniformly distributed, no
    // engine-dependent bias) and falls back to Math.random() otherwise.
    function coinIsHeads() {
        if (window.crypto && window.crypto.getRandomValues) {
            var buf = new Uint32Array(1);
            window.crypto.getRandomValues(buf);
            return (buf[0] % 2) === 0;
        }
        return Math.random() < 0.5;
    }

    el('btn-flip').addEventListener('click', function () {
        if (!state) return;
        el('btn-flip').disabled = true;
        var winnerKey = coinIsHeads() ? 'A' : 'B';
        state.tossWinnerKey = winnerKey;
        var spins = 5 + Math.floor(Math.random() * 3);
        var targetDeg = spins * 360 + (winnerKey === 'B' ? 180 : 0);
        el('coin').style.transform = 'rotateY(' + targetDeg + 'deg)';

        setTimeout(function () {
            el('toss-winner-text').textContent = state.teams[winnerKey].name + ' won the toss!';
            el('toss-result').classList.remove('hidden');
            el('btn-flip').style.display = 'none';
        }, 2500);
    });

    el('toss-result').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-choice]');
        if (!btn) return;
        var choice = btn.dataset.choice;
        var winner = state.tossWinnerKey;
        var other = winner === 'A' ? 'B' : 'A';
        state.order = choice === 'bat' ? [winner, other] : [other, winner];
        startInnings(1);
        showScreen('match');
    });

    /* ==========================================================
       Match core
       ========================================================== */
    function battingKey() { return state.order[state.innings - 1]; }
    function bowlingKey() { return state.order[2 - state.innings]; }
    function battingTeam() { return state.teams[battingKey()]; }
    function bowlingTeam() { return state.teams[bowlingKey()]; }
    function totalLegalBallsAllowed() { return state.config.overs * 6; }

    function startInnings(n) {
        state.innings = n;
        state.freeHit = false;
        render();
    }

    function fmtOvers(legalBalls) {
        var o = Math.floor(legalBalls / 6);
        var b = legalBalls % 6;
        return o + '.' + b;
    }
    function crr(team) {
        var oversFaced = team.legalBalls / 6;
        if (oversFaced <= 0) return 0;
        return team.runs / oversFaced;
    }
    function wicketsRemainingText(team) {
        var rem = state.config.wickets - team.wickets;
        return rem + ' wicket' + (rem === 1 ? '' : 's');
    }

    function locked() { return !state || state.matchOver; }

    function appendChip(label, cls) {
        battingTeam().currentChips.push({ label: label, cls: cls });
    }

    function checkOverComplete() {
        var t = battingTeam();
        if (t.legalBalls > 0 && t.legalBalls % 6 === 0) {
            t.overHistory.push(t.currentChips.slice());
            t.currentChips = [];
        }
    }

    function applyBase(runs, wicketDelta, extraDelta, isLegal) {
        var t = battingTeam();
        t.runs += runs;
        t.wickets += wicketDelta;
        t.extras += extraDelta;
        if (isLegal) t.legalBalls += 1;
    }

    /* -- finishers: keep over-completion checks scoped to legal balls only -- */
    function finishLegalBall() {
        state.freeHit = false; // any legal, fairly-bowled delivery consumes an active Free Hit
        checkOverComplete();
        render();
        evaluateMatchState();
    }
    function finishIllegalEvent() {
        render();
        evaluateMatchState();
    }

    /* ---------- Instant single-tap actions ---------- */
    function doDot() {
        if (locked()) return;
        applyBase(0, 0, 0, true);
        appendChip('•', 'dot');
        finishLegalBall();
    }
    function doRuns(n) {
        if (locked()) return;
        applyBase(n, 0, 0, true);
        appendChip(String(n), n >= 6 ? 'runs6' : (n === 4 ? 'runs4' : ''));
        finishLegalBall();
    }
    function doWicket() {
        if (locked()) return;
        if (state.freeHit) {
            // Free Hit protects the batter from a normal dismissal - this ball
            // is recorded exactly as a Dot would be, nothing added.
            applyBase(0, 0, 0, true);
            appendChip('•', 'dot');
            showToast('Free Hit — no wicket, recorded as a dot.');
            finishLegalBall();
            return;
        }
        applyBase(0, 1, 0, true);
        appendChip('W', 'wicket');
        finishLegalBall();
    }
    function doRtdHurt() {
        if (locked()) return;
        applyBase(0, 1, 0, false);
        appendChip('RH', 'extra');
        finishIllegalEvent();
        showToast('Batter retired hurt');
    }

    /* ---------- Wide / No Ball (mandatory run applies instantly, then a popup for anything extra) ---------- */
    function doWide() { startExtraBall('Wd', 'Runs scored on Wide'); }
    function doNoBall() { startExtraBall('Nb', 'Runs scored on No Ball'); }

    function startExtraBall(prefix, title) {
        if (locked()) return;
        var wasFreeHit = state.freeHit;
        // A wicket never counts on a No Ball (only Run Out is a valid dismissal
        // off a no-ball), and never counts while a Free Hit is already active -
        // either condition means "Wicket" resolves exactly like Dot below.
        var blockWicket = wasFreeHit || prefix === 'Nb';
        applyBase(1, 0, 1, false);

        // A No Ball always grants the following delivery(ies) a Free Hit - this
        // stays true even through further illegal balls, until a fair one is bowled.
        if (prefix === 'Nb') state.freeHit = true;
        render();

        // The mandatory run alone can already seal a chase - end it right there.
        if (state.innings === 2 && battingTeam().runs >= state.target) {
            appendChip(prefix, 'extra');
            finishMatch(battingTeam().name + ' won by ' + wicketsRemainingText(battingTeam()));
            return;
        }

        openSubRunModal(
            title,
            EXTRA_OPTIONS,
            function (val) { resolveExtra(prefix, val, blockWicket); },
            function () { resolveExtra(prefix, 0, blockWicket); }
        );
    }

    function resolveExtra(prefix, val, blockWicket) {
        var t = battingTeam();
        var chip = prefix, cls = 'extra';
        if (val === 'W') {
            if (blockWicket) {
                // No Ball or an active Free Hit - the "Wicket" tap is recorded as
                // if Dot had been picked instead: nothing added, chip unchanged.
            } else {
                t.wickets += 1; chip += '+W'; cls = 'wicket';
            }
        } else if (val === 'RO') {
            t.wickets += 1; chip += '+RO'; cls = 'wicket'; // Run Out always stands, Free Hit or not
        } else if (typeof val === 'number' && val > 0) {
            t.runs += val; t.extras += val; chip += val;
            cls = val >= 6 ? 'runs6' : (val === 4 ? 'runs4' : 'extra');
        }
        appendChip(chip, cls);
        // Illegal ball: state.freeHit is deliberately left untouched here -
        // a Wide never grants/clears it, and a No Ball already set it above.
        finishIllegalEvent();
    }

    /* ---------- Run out (fair delivery) ---------- */
    function doRunOut() {
        if (locked()) return;
        openSubRunModal('Runs scored before Run Out', RUNOUT_OPTIONS, function (val) { resolveRunOut(val); }, null);
    }
    function resolveRunOut(val) {
        applyBase(val, 1, 0, true);
        appendChip(val > 0 ? (val + '+RO') : 'RO', 'wicket');
        finishLegalBall();
    }

    /* ==========================================================
       Innings / match end evaluation
       ========================================================== */
    function evaluateMatchState() {
        if (state.matchOver) return;
        var t = battingTeam();
        var allOut = t.wickets >= state.config.wickets;
        var oversDone = t.legalBalls >= totalLegalBallsAllowed();

        if (state.innings === 2) {
            if (t.runs >= state.target) {
                finishMatch(t.name + ' won by ' + wicketsRemainingText(t));
                return;
            }
            if (allOut || oversDone) {
                var margin = state.target - 1 - t.runs;
                if (margin === 0) finishMatch('Match tied');
                else finishMatch(bowlingTeam().name + ' won by ' + margin + ' run' + (margin === 1 ? '' : 's'));
                return;
            }
        } else {
            if (allOut || oversDone) triggerInningsBreak();
        }
    }

    function triggerInningsBreak() {
        var t = battingTeam();
        state.target = t.runs + 1;
        el('inningsbreak-body').innerHTML =
            '<p><strong>' + t.name + '</strong> finished on <strong>' + t.runs + '-' + t.wickets + '</strong> in ' + fmtOvers(t.legalBalls) + ' overs.</p>' +
            '<p>' + bowlingTeam().name + ' need <strong>' + state.target + '</strong> run' + (state.target === 1 ? '' : 's') +
            ' to win from <strong>' + totalLegalBallsAllowed() + '</strong> balls.</p>';
        openModal('modal-inningsbreak');
    }
    el('btn-start-innings2').addEventListener('click', function () {
        closeModal('modal-inningsbreak');
        startInnings(2);
    });

    function finishMatch(text) {
        state.matchOver = true;
        var a = state.teams.A, b = state.teams.B;
        el('result-body').innerHTML =
            '<p class="result-line">' + text + '</p>' +
            '<div class="innings-summary"><span>' + a.name + '</span><span>' + a.runs + '-' + a.wickets + ' (' + fmtOvers(a.legalBalls) + ')</span></div>' +
            '<div class="innings-summary"><span>' + b.name + '</span><span>' + b.runs + '-' + b.wickets + ' (' + fmtOvers(b.legalBalls) + ')</span></div>';
        spawnConfetti();
        openModal('modal-result');
        render();
    }
    el('btn-new-match').addEventListener('click', function () {
        closeModal('modal-result');
        state = null;
        showScreen('setup');
    });

    /* ==========================================================
       Sub-run modal (shared by Wide / No Ball / Run Out)
       ========================================================== */
    var subrunOnClose = null;
    function openSubRunModal(title, options, onSelect, onClose) {
        el('subrun-title').textContent = title;
        var container = el('subrun-options');
        container.innerHTML = '';
        options.forEach(function (opt) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = opt.label;
            if (opt.danger) b.classList.add('opt-wicket');
            if (opt.disabled) {
                b.disabled = true;
            } else {
                b.addEventListener('click', function () {
                    closeModal('modal-subrun');
                    subrunOnClose = null;
                    onSelect(opt.value);
                });
            }
            container.appendChild(b);
        });
        subrunOnClose = onClose;
        openModal('modal-subrun');
    }
    el('subrun-close').addEventListener('click', function () {
        closeModal('modal-subrun');
        var cb = subrunOnClose;
        subrunOnClose = null;
        if (cb) cb();
    });

    /* ==========================================================
       Scoreboard modal
       ========================================================== */
    function chipHtml(c) { return '<div class="chip ' + (c.cls || '') + '">' + c.label + '</div>'; }

    function openScoreboard() {
        if (!state) return;
        var t = battingTeam();
        var html = '';
        if (state.innings === 2) {
            var first = state.teams[state.order[0]];
            html += '<div class="innings-summary"><span>' + first.name + ' (1st Inn)</span><span>' + first.runs + '-' + first.wickets + ' (' + fmtOvers(first.legalBalls) + ')</span></div>';
        }
        html += '<div class="innings-summary"><span>' + t.name + ' (Inn ' + state.innings + ')</span><span>' + t.runs + '-' + t.wickets + ' (' + fmtOvers(t.legalBalls) + ')</span></div>';

        var overs = t.overHistory.slice();
        if (t.currentChips.length) overs.push(t.currentChips);
        if (overs.length === 0) {
            html += '<p class="modal-note">No balls bowled yet.</p>';
        } else {
            overs.forEach(function (chips, idx) {
                html += '<div class="over-row"><span class="over-label">Over ' + (idx + 1) + '</span><div class="ball-chips">' +
                    chips.map(chipHtml).join('') + '</div></div>';
            });
        }
        el('scoreboard-body').innerHTML = html;
        openModal('modal-scoreboard');
    }
    el('scoreboard-close').addEventListener('click', function () { closeModal('modal-scoreboard'); });

    /* ==========================================================
       Action grid delegation
       ========================================================== */
    el('action-grid').addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn || !state) return;
        switch (btn.dataset.action) {
            case 'dot': doDot(); break;
            case '1': doRuns(1); break;
            case '2': doRuns(2); break;
            case '3': doRuns(3); break;
            case '4': doRuns(4); break;
            case '6': doRuns(6); break;
            case 'wicket': doWicket(); break;
            case 'wide': doWide(); break;
            case 'noball': doNoBall(); break;
            case 'runout': doRunOut(); break;
            case 'rtdhurt': doRtdHurt(); break;
            case 'scoreboard': openScoreboard(); break;
        }
    });

    /* ==========================================================
       Render
       ========================================================== */
    function render() {
        if (!state) return;
        var t = battingTeam(), bwl = bowlingTeam();

        el('pill-batting').textContent = t.name + ' 🏏';
        el('pill-bowling').textContent = bwl.name;
        el('pill-batting').classList.add('batting');
        el('pill-bowling').classList.remove('batting');

        el('score-main').textContent = t.runs + '-' + t.wickets;
        el('stat-overs').textContent = fmtOvers(t.legalBalls) + ' / ' + state.config.overs;
        el('stat-extras').textContent = t.extras;
        el('stat-crr').textContent = crr(t).toFixed(2);

        if (state.innings === 2) {
            var runsNeeded = Math.max(state.target - t.runs, 0);
            var ballsLeft = Math.max(totalLegalBallsAllowed() - t.legalBalls, 0);
            var oversLeft = ballsLeft / 6;
            var rrrVal = oversLeft > 0 ? (runsNeeded / oversLeft) : 0;

            el('rrr-chip').hidden = false;
            el('stat-rrr').textContent = ballsLeft > 0 ? rrrVal.toFixed(2) : '—';
            el('target-line').hidden = false;
            el('target-line').textContent = t.name + ' need ' + runsNeeded + ' run' + (runsNeeded === 1 ? '' : 's') +
                ' from ' + ballsLeft + ' ball' + (ballsLeft === 1 ? '' : 's') + ' to win.';
        } else {
            el('rrr-chip').hidden = true;
            el('target-line').hidden = true;
        }

        el('freehit-banner').hidden = !state.freeHit;

        el('ball-chips').innerHTML = t.currentChips.length
            ? t.currentChips.map(chipHtml).join('')
            : '<span class="ball-empty">New over starting…</span>';
    }

    /* ==========================================================
       Confetti (win celebration)
       ========================================================== */
    function spawnConfetti() {
        var layer = el('confetti-layer');
        if (!layer) return;
        layer.innerHTML = '';
        var colors = ['#F0B429', '#C4342B', '#3C8C61', '#F5ECDA', '#6E93AE'];
        for (var i = 0; i < 26; i++) {
            var p = document.createElement('span');
            p.className = 'confetti-piece';
            p.style.left = (Math.random() * 100) + '%';
            p.style.background = colors[Math.floor(Math.random() * colors.length)];
            p.style.animationDelay = (Math.random() * 0.6) + 's';
            p.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
            layer.appendChild(p);
        }
    }

})();
