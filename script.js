const STORAGE_KEY = "lp-poo-study-progress-v1";
const letters = ["A", "B", "C", "D", "E"];

const app = {
  progress: loadProgress(),
  quiz: null,
  selected: null,
  answered: false
};

function loadProgress() {
  const empty = { questions: {}, history: [], attemptOrder: 0 };
  try {
    return { ...empty, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return empty;
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(app.progress));
}

function questionStats(id) {
  if (!app.progress.questions[id]) {
    app.progress.questions[id] = { attempts: 0, correct: 0, wrong: 0, lastAttempt: 0 };
  }
  return app.progress.questions[id];
}

function mainQuestions() {
  return QUESTION_BANK.filter(q => q.mainNumber);
}

function byId(id) {
  return QUESTION_BANK.find(q => q.id === id);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function weightedPool(items) {
  const pool = [];
  items.forEach(q => {
    const stats = app.progress.questions[q.id];
    const mistakeBoost = stats ? Math.min(stats.wrong * 2, 8) : 0;
    const weight = (q.priority || 1) + mistakeBoost;
    for (let i = 0; i < weight; i++) pool.push(q);
  });
  return shuffle(pool);
}

function uniqueTake(pool, count) {
  const selected = [];
  const seen = new Set();
  for (const q of pool) {
    if (!seen.has(q.id)) {
      selected.push(q);
      seen.add(q.id);
    }
    if (selected.length === count) break;
  }
  return selected;
}

function selectQuestions(mode) {
  const all = QUESTION_BANK;
  const mains = mainQuestions();
  const shuffle30 = document.getElementById("shuffleMain30")?.checked;
  if (mode === "main30" || mode === "main30study") return shuffle30 ? shuffle(mains) : [...mains];
  if (mode === "quiz20") return uniqueTake(weightedPool(all), 20);
  if (mode === "quiz30") return uniqueTake(weightedPool(all), 30);
  if (mode === "all") return shuffle(all);
  if (mode === "likely") {
    const topics = new Set(["Polimorfismo", "Herança", "Encapsulamento", "Classes e Objetos", "__init__", "super()", "Composição e Agregação", "Abstração", "SRP", "OCP", "DIP"]);
    return uniqueTake(weightedPool(all.filter(q => q.mainNumber || topics.has(q.topic))), 15);
  }
  if (mode === "errors" || mode === "main30errors") {
    const scope = mode === "main30errors" ? mains : all;
    const missed = scope
      .filter(q => (app.progress.questions[q.id]?.wrong || 0) > 0)
      .sort((a, b) => {
        const sa = app.progress.questions[a.id];
        const sb = app.progress.questions[b.id];
        return (sb.wrong - sb.correct) - (sa.wrong - sa.correct) || sb.wrong - sa.wrong;
      });
    return missed.length ? missed.slice(0, Math.min(missed.length, 20)) : uniqueTake(weightedPool(scope), Math.min(10, scope.length));
  }
  return uniqueTake(weightedPool(mains), 10);
}

function startQuiz(mode) {
  const questions = selectQuestions(mode);
  if (!questions.length) return;
  app.quiz = {
    mode,
    questions,
    index: 0,
    correct: 0,
    wrong: 0,
    answers: []
  };
  app.selected = null;
  app.answered = false;
  document.getElementById("quizShell").classList.remove("hidden");
  document.getElementById("resultModal").classList.add("hidden");
  renderQuestion();
}

function renderQuestion() {
  const quiz = app.quiz;
  const q = quiz.questions[quiz.index];
  app.selected = null;
  app.answered = false;
  document.getElementById("quizModeLabel").textContent = modeLabel(quiz.mode);
  document.getElementById("quizTitle").textContent = q.mainNumber ? `Questão ${q.mainNumber} da Aula 6` : "Questão extra";
  document.getElementById("questionCounter").textContent = `Questão ${quiz.index + 1} de ${quiz.questions.length}`;
  document.getElementById("liveCorrect").textContent = `Acertos: ${quiz.correct}`;
  document.getElementById("liveWrong").textContent = `Erros: ${quiz.wrong}`;
  document.getElementById("progressBar").style.width = `${(quiz.index / quiz.questions.length) * 100}%`;
  document.getElementById("sourceBadge").textContent = q.source;
  document.getElementById("topicBadge").textContent = q.topic;
  document.getElementById("questionText").textContent = q.prompt;
  document.getElementById("feedbackBox").className = "feedback hidden";
  document.getElementById("feedbackBox").innerHTML = "";
  document.getElementById("confirmAnswerBtn").disabled = false;
  document.getElementById("nextQuestionBtn").disabled = true;
  document.getElementById("nextQuestionBtn").textContent = quiz.index === quiz.questions.length - 1 ? "Finalizar" : "Próxima questão";

  const options = document.getElementById("optionsList");
  options.innerHTML = "";
  q.options.forEach((option, index) => {
    const btn = document.createElement("button");
    btn.className = "option";
    btn.type = "button";
    btn.innerHTML = `<span class="letter">${letters[index]}</span><span>${option}</span>`;
    btn.addEventListener("click", () => selectOption(index));
    options.appendChild(btn);
  });
}

function modeLabel(mode) {
  const labels = {
    exam10: "Simulado de 10 questões",
    quiz20: "Simulado de 20 questões",
    quiz30: "Simulado de 30 questões",
    all: "Todas as questões",
    likely: "O que pode cair na prova",
    errors: "Simulado dos meus erros",
    main30: "30 questões da Aula 6",
    main30study: "Estudo das 30 questões",
    main30errors: "Erradas das 30 principais"
  };
  return labels[mode] || "Simulado";
}

function selectOption(index) {
  if (app.answered) return;
  app.selected = index;
  [...document.querySelectorAll(".option")].forEach((el, i) => {
    el.classList.toggle("selected", i === index);
  });
}

function confirmAnswer() {
  if (app.selected === null || app.answered) return;
  const quiz = app.quiz;
  const q = quiz.questions[quiz.index];
  const correct = app.selected === q.answer;
  app.answered = true;
  correct ? quiz.correct++ : quiz.wrong++;
  quiz.answers.push({ id: q.id, selected: app.selected, correct });

  const stats = questionStats(q.id);
  stats.attempts++;
  stats.correct += correct ? 1 : 0;
  stats.wrong += correct ? 0 : 1;
  stats.lastAttempt = ++app.progress.attemptOrder;
  saveProgress();

  [...document.querySelectorAll(".option")].forEach((el, i) => {
    if (i === q.answer) el.classList.add("correct");
    if (i === app.selected && !correct) el.classList.add("wrong");
  });

  const feedback = document.getElementById("feedbackBox");
  feedback.className = `feedback ${correct ? "correct" : "wrong"}`;
  feedback.innerHTML = correct
    ? `<strong>✓ Acertei</strong><p>${q.explanation}</p><p><b>Assunto:</b> ${q.topic}</p>`
    : `<strong>✗ Errei</strong><p><b>Você marcou:</b> ${letters[app.selected]} - ${q.options[app.selected]}</p><p><b>Correta:</b> ${letters[q.answer]} - ${q.options[q.answer]}</p><p>${q.explanation}</p><p><b>Assunto:</b> ${q.topic}</p>`;

  document.getElementById("liveCorrect").textContent = `Acertos: ${quiz.correct}`;
  document.getElementById("liveWrong").textContent = `Erros: ${quiz.wrong}`;
  document.getElementById("confirmAnswerBtn").disabled = true;
  document.getElementById("nextQuestionBtn").disabled = false;
  renderDynamicSections();
}

function nextQuestion() {
  const quiz = app.quiz;
  if (quiz.index < quiz.questions.length - 1) {
    quiz.index++;
    renderQuestion();
    return;
  }
  finishQuiz();
}

function finishQuiz() {
  const quiz = app.quiz;
  const total = quiz.questions.length;
  const percent = total ? Math.round((quiz.correct / total) * 1000) / 10 : 0;
  app.progress.history.unshift({
    date: new Date().toLocaleString("pt-BR"),
    mode: modeLabel(quiz.mode),
    total,
    correct: quiz.correct,
    wrong: quiz.wrong,
    percent
  });
  app.progress.history = app.progress.history.slice(0, 30);
  saveProgress();
  document.getElementById("progressBar").style.width = "100%";
  document.getElementById("resultSummary").innerHTML = `
    <div class="metrics-grid">
      <div class="metric"><span>Questões</span><strong>${total}</strong></div>
      <div class="metric"><span>Acertos</span><strong>${quiz.correct}</strong></div>
      <div class="metric"><span>Erros</span><strong>${quiz.wrong}</strong></div>
      <div class="metric"><span>Aproveitamento</span><strong>${percent}%</strong></div>
    </div>
    <p>${performanceMessage(percent)}</p>
  `;
  document.getElementById("resultModal").classList.remove("hidden");
  renderDynamicSections();
}

function performanceMessage(percent) {
  if (percent >= 85) return "Desempenho forte. Continue revisando as questões erradas para manter consistência.";
  if (percent >= 70) return "Bom resultado. Revise os assuntos com menor percentual para ganhar segurança.";
  if (percent >= 50) return "Você já tem base, mas precisa repetir os tópicos em que mais errou.";
  return "Priorize revisão rápida e simulados dos erros antes de tentar simulados maiores.";
}

function aggregateStats(scope = QUESTION_BANK) {
  return scope.reduce((acc, q) => {
    const s = app.progress.questions[q.id];
    if (!s) return acc;
    acc.attempts += s.attempts;
    acc.correct += s.correct;
    acc.wrong += s.wrong;
    return acc;
  }, { attempts: 0, correct: 0, wrong: 0 });
}

function topicStats() {
  const map = {};
  QUESTION_BANK.forEach(q => {
    const s = app.progress.questions[q.id];
    if (!s) return;
    if (!map[q.topic]) map[q.topic] = { topic: q.topic, attempts: 0, correct: 0, wrong: 0 };
    map[q.topic].attempts += s.attempts;
    map[q.topic].correct += s.correct;
    map[q.topic].wrong += s.wrong;
  });
  return Object.values(map).sort((a, b) => (a.correct / Math.max(a.attempts, 1)) - (b.correct / Math.max(b.attempts, 1)));
}

function renderDashboard() {
  const stats = aggregateStats();
  const percent = stats.attempts ? Math.round((stats.correct / stats.attempts) * 1000) / 10 : 0;
  document.getElementById("dashboardMetrics").innerHTML = `
    <div class="metric"><span>Total respondidas</span><strong>${stats.attempts}</strong></div>
    <div class="metric"><span>Acertos</span><strong>${stats.correct}</strong></div>
    <div class="metric"><span>Erros</span><strong>${stats.wrong}</strong></div>
    <div class="metric"><span>Percentual geral</span><strong>${percent}%</strong></div>
  `;
  renderHardQuestions("dashboardHardQuestions", 5);
  renderWeakTopics("dashboardWeakTopics", 5);
}

function renderHardQuestions(targetId, limit = 99) {
  const rows = QUESTION_BANK
    .map(q => ({ q, s: app.progress.questions[q.id] }))
    .filter(x => x.s?.wrong)
    .sort((a, b) => b.s.wrong - a.s.wrong || a.s.correct - b.s.correct)
    .slice(0, limit);
  const target = document.getElementById(targetId);
  if (!rows.length) {
    target.innerHTML = `<p class="empty">Ainda não há erros registrados.</p>`;
    return;
  }
  target.innerHTML = rows.map(({ q, s }) => `
    <div class="list-row">
      <strong>${q.mainNumber ? `Questão ${q.mainNumber}` : q.id} - ${q.topic}</strong>
      <span>Erros: ${s.wrong} | Acertos: ${s.correct} | Fonte: ${q.source}</span>
    </div>
  `).join("");
}

function renderWeakTopics(targetId, limit = 99) {
  const rows = topicStats().filter(t => t.attempts).slice(0, limit);
  const target = document.getElementById(targetId);
  if (!rows.length) {
    target.innerHTML = `<p class="empty">Responda algumas questões para aparecerem os assuntos.</p>`;
    return;
  }
  target.innerHTML = rows.map(t => {
    const percent = Math.round((t.correct / t.attempts) * 100);
    return `<div class="topic-row"><strong>${t.topic} - ${percent}%</strong><span>${t.correct} acertos, ${t.wrong} erros</span><div class="bar"><span style="width:${percent}%"></span></div></div>`;
  }).join("");
}

function renderMain30Stats() {
  const stats = aggregateStats(mainQuestions());
  const percent = stats.attempts ? Math.round((stats.correct / stats.attempts) * 1000) / 10 : 0;
  document.getElementById("main30Stats").innerHTML = `
    <div class="list-row"><strong>Respondidas nas 30 principais</strong><span>${stats.attempts} tentativas</span></div>
    <div class="list-row"><strong>Aproveitamento</strong><span>${percent}% (${stats.correct} acertos / ${stats.wrong} erros)</span></div>
  `;
}

function renderReview() {
  document.getElementById("reviewGrid").innerHTML = QUICK_REVIEW.map(item => `
    <article class="review-item">
      <h3>${item.topic}</h3>
      <p><b>Definição simples:</b> ${item.definition}</p>
      <p><b>Exemplo:</b> ${item.example}</p>
      <p><b>O que lembrar para a prova:</b> ${item.remember}</p>
    </article>
  `).join("");
}

function renderMistakes() {
  const rows = QUESTION_BANK
    .map(q => ({ q, s: app.progress.questions[q.id] }))
    .filter(x => x.s?.wrong)
    .sort((a, b) => b.s.wrong - a.s.wrong || b.s.lastAttempt - a.s.lastAttempt);
  const target = document.getElementById("mistakesList");
  if (!rows.length) {
    target.innerHTML = `<p class="empty">Você ainda não errou questões. Faça um simulado para começar o histórico.</p>`;
    return;
  }
  target.innerHTML = `
    <table>
      <thead><tr><th>Questão</th><th>Assunto</th><th>Erros</th><th>Acertos</th><th>%</th><th>Ação</th></tr></thead>
      <tbody>
        ${rows.map(({ q, s }) => {
          const percent = Math.round((s.correct / s.attempts) * 100);
          return `<tr><td>${q.mainNumber ? `Questão ${q.mainNumber}` : q.id}<br><small>${q.source}</small></td><td>${q.topic}</td><td>${s.wrong}</td><td>${s.correct}</td><td>${percent}%</td><td><button class="secondary mini-train" data-qid="${q.id}" type="button">Treinar novamente</button></td></tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
  document.querySelectorAll(".mini-train").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = byId(btn.dataset.qid);
      app.quiz = { mode: "errors", questions: [q], index: 0, correct: 0, wrong: 0, answers: [] };
      document.getElementById("quizShell").classList.remove("hidden");
      renderQuestion();
    });
  });
}

function renderPerformance() {
  const topics = topicStats();
  document.getElementById("topicPerformance").innerHTML = topics.length ? topics.map(t => {
    const percent = Math.round((t.correct / t.attempts) * 100);
    return `<div class="topic-row"><strong>${t.topic} - ${percent}% de acertos</strong><span>${t.attempts} respostas | ${t.wrong} erros</span><div class="bar"><span style="width:${percent}%"></span></div></div>`;
  }).join("") : `<p class="empty">Sem dados ainda.</p>`;

  document.getElementById("historyList").innerHTML = app.progress.history.length ? app.progress.history.map((h, i) => `
    <div class="list-row"><strong>Simulado ${app.progress.history.length - i} - ${h.correct}/${h.total}</strong><span>${h.mode} | ${h.percent}% | ${h.date}</span></div>
  `).join("") : `<p class="empty">Nenhum simulado finalizado ainda.</p>`;
}

function renderDynamicSections() {
  renderDashboard();
  renderMain30Stats();
  renderMistakes();
  renderPerformance();
}

function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === name));
  document.getElementById(`${name}View`).classList.add("active");
  renderDynamicSections();
}

function resetProgress() {
  if (!confirm("Tem certeza que deseja apagar todo o progresso, histórico e questões erradas?")) return;
  app.progress = { questions: {}, history: [], attemptOrder: 0 };
  saveProgress();
  renderDynamicSections();
}

document.addEventListener("click", event => {
  const start = event.target.closest("[data-start]")?.dataset.start;
  if (start) startQuiz(start);
  const view = event.target.closest("[data-view-target]")?.dataset.viewTarget;
  if (view) showView(view);
});

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => showView(tab.dataset.view)));
document.getElementById("confirmAnswerBtn").addEventListener("click", confirmAnswer);
document.getElementById("nextQuestionBtn").addEventListener("click", nextQuestion);
document.getElementById("exitQuizBtn").addEventListener("click", () => document.getElementById("quizShell").classList.add("hidden"));
document.getElementById("finishQuizBtn").addEventListener("click", () => {
  document.getElementById("quizShell").classList.add("hidden");
  document.getElementById("resultModal").classList.add("hidden");
  showView("dashboard");
});
document.getElementById("resetProgressBtn").addEventListener("click", resetProgress);

renderReview();
renderDynamicSections();
