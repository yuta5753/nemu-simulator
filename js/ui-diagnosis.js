window.Sim = window.Sim || {}; Sim.ui = Sim.ui || {};
(function () { function render(el) { el.innerHTML = '<div class="card placeholder">診断は準備中です（Task 7）</div>'; } Sim.ui.diagnosis = { render, refresh: render }; })();
