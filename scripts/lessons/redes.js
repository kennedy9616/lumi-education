/* Questionários e diagramas das aulas de Redes de Computadores. */
(() => {
  'use strict';
  const quizzes = [...document.querySelectorAll('.quiz-card')];
  const score = document.querySelector('.quiz-score');

  quizzes.forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const selected = form.querySelector('input:checked');
    const feedback = form.querySelector('.feedback');
    feedback.hidden = false;
    if (!selected) {
      feedback.className = 'feedback';
      feedback.textContent = 'Escolha uma alternativa antes de conferir.';
      return;
    }
    const correct = Number(selected.value) === Number(form.dataset.answer);
    form.dataset.correct = String(correct);
    feedback.className = 'feedback ' + (correct ? 'correct' : 'incorrect');
    feedback.textContent = (correct ? 'Resposta correta. ' : 'Revise sua resposta. ') + form.dataset.explanation;
    score.textContent = quizzes.filter(quiz => quiz.dataset.correct === 'true').length +
      ' de ' + quizzes.length + ' questões corretas. Você pode tentar novamente.';
  }));

  document.querySelectorAll('[data-reset-quiz]').forEach(button => button.addEventListener('click', () => {
    quizzes.forEach(form => {
      form.reset();
      delete form.dataset.correct;
      form.querySelector('.feedback').hidden = true;
    });
    score.textContent = 'Responda no seu ritmo. As respostas não são enviadas.';
  }));

  document.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', () => {
    const figure = document.getElementById(button.dataset.play);
    const playing = figure.classList.toggle('playing');
    button.textContent = playing ? 'Pausar percurso' : 'Animar percurso';
    button.setAttribute('aria-pressed', String(playing));
  }));

  function selectDiagram(buttons, figures, attribute, status, descriptions) {
    buttons.forEach(button => button.addEventListener('click', () => {
      buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      const mode = button.dataset.mode || button.dataset.waveMode;
      status.textContent = descriptions[mode];
      // O valor explícito também revela grupos cujo CSS inicial é display:none.
      figures.forEach(figure => { figure.style.display = figure.dataset[attribute] === mode ? 'inline' : 'none'; });
    }));
  }

  const switching = document.querySelector('#switching');
  if (switching) selectDiagram(
    switching.querySelectorAll('[data-mode]'),
    switching.querySelectorAll('[data-network-mode]'),
    'networkMode', switching.querySelector('[data-status]'), {
      circuito: 'Circuitos: primeiro o caminho é reservado; depois os dados percorrem o canal exclusivo; ao final, a conexão é desfeita.',
      mensagem: 'Mensagens: cada nó recebe a mensagem inteira antes de encaminhá-la ao próximo. Não há reserva prévia do caminho.',
      pacotes: 'Pacotes: a mensagem é dividida em unidades menores. No modo datagrama, cada pacote pode seguir um caminho diferente.'
    }
  );

  const encapsulation = document.querySelector('#encapsulation');
  if (encapsulation) {
    let step = 0;
    const descriptions = [
      'Aplicação: a mensagem original é preparada.',
      'Transporte: o cabeçalho de transporte envolve a mensagem.',
      'Rede: um cabeçalho de rede envolve o segmento.',
      'Enlace: o quadro envolve o datagrama; o esquema do material também mostra o FCS.',
      'Física: a informação atravessa o meio como bits representados por sinais.',
      'Receptor / Enlace: as informações de enlace são examinadas e retiradas.',
      'Receptor / Rede: o cabeçalho de rede é retirado.',
      'Receptor / Transporte: o cabeçalho de transporte é retirado.',
      'Receptor / Aplicação: a mensagem é entregue à aplicação.'
    ];
    function draw() {
      const depth = step <= 4 ? Math.min(step, 3) : Math.max(0, 7 - step);
      encapsulation.querySelectorAll('[data-envelope]').forEach(group => {
        group.style.visibility = Number(group.dataset.envelope) <= depth ? 'visible' : 'hidden';
      });
      encapsulation.querySelector('[data-status]').textContent = (step + 1) + '/9 · ' + descriptions[step];
      encapsulation.querySelector('[data-step-label]').textContent = step < 4 ? 'EMISSOR' : step === 4 ? 'MEIO FÍSICO' : 'RECEPTOR';
      encapsulation.querySelector('[data-enc-prev]').disabled = step === 0;
      encapsulation.querySelector('[data-enc-next]').disabled = step === 8;
      encapsulation.querySelector('[data-bits]').style.visibility = step === 4 ? 'visible' : 'hidden';
    }
    encapsulation.querySelector('[data-enc-prev]').addEventListener('click', () => { step = Math.max(0, step - 1); draw(); });
    encapsulation.querySelector('[data-enc-next]').addEventListener('click', () => { step = Math.min(8, step + 1); draw(); });
    encapsulation.querySelector('[data-enc-reset]').addEventListener('click', () => { step = 0; draw(); });
    draw();
  }

  const waveStatus = document.querySelector('#wave-status');
  if (waveStatus) selectDiagram(
    document.querySelectorAll('[data-wave-mode]'), document.querySelectorAll('[data-wave]'),
    'wave', waveStatus, {
      analogico: 'Analógico: amplitude contínua. O esquema destaca uma onda periódica; amplitude, período e frequência descrevem seu comportamento.',
      digital: 'Digital: níveis discretos representam bits. A forma retangular é uma representação didática do sinal.',
      ruido: 'Ruído: perturbações se somam ao sinal original. As curvas são ilustrativas, sem escala quantitativa.',
      atenuacao: 'Atenuação: a amplitude diminui ao longo do caminho. O desenho é qualitativo e não representa uma lei de atenuação específica.'
    }
  );
})();
