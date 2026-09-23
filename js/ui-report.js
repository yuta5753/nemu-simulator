window.Sim = window.Sim || {}; Sim.ui = Sim.ui || {};
(function () { function render(el) { el.innerHTML = '<div class="card placeholder">レポートは準備中です（Task 9）</div>'; } Sim.ui.report = { render, refresh: render }; })();
