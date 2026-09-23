window.Sim = window.Sim || {}; Sim.ui = Sim.ui || {};
(function () { function render(el) { el.innerHTML = '<div class="card placeholder">目標と戦略は準備中です（Task 8）</div>'; } Sim.ui.plan = { render, refresh: render }; })();
