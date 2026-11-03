const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const nl2br = (value = '') => escapeHtml(value).replace(/\n/g, '<br>');
const safeName = (value = '') => String(value).replace(/[\\/:*?"<>|]/g, '_');
const today = new Date();
const toDateInput = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const parseDate = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const dayDiff = (from, to) => Math.round((Date.UTC(to.getFullYear(),to.getMonth(),to.getDate()) - Date.UTC(from.getFullYear(),from.getMonth(),from.getDate())) / 86400000);
const formatWon = (value) => `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
const downloadBlob = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
};

// Homepage directory and the reference site's tabbed recommendation area.
const toolCards = $$('.tool-card');
let activeFilter = 'all';
function filterTools() {
  let visible = 0;
  toolCards.forEach((card) => {
    const categoryMatches = activeFilter === 'all' || card.dataset.category === activeFilter;
    card.hidden = !categoryMatches;
    if (!card.hidden) visible += 1;
  });
  $('#tool-count').textContent = activeFilter === 'all' ? `전체 ${visible}개` : `${visible}개 표시`;
}
$$('.filter-chip').forEach((button) => button.addEventListener('click', () => {
  $$('.filter-chip').forEach((chip) => chip.classList.toggle('selected', chip === button));
  activeFilter = button.dataset.filter;
  filterTools();
}));

const toolNames = {crypto:'문서 암호화',proposal:'사업 계획서 작성',duty:'당직 일정 짜기',devotional:'경건회 일정 짜기',roulette:'랜덤 뽑기 룰렛',grade:'초·중·고 학년표',age:'나이 계산기',middle:'중위소득 계산기',welfare:'복지 서비스 찾기'};
const dialog = $('#tool-dialog');
function openTool(name) {
  if (!toolNames[name]) return;
  $('#dialog-title').textContent = toolNames[name];
  $$('.tool-view').forEach((view) => { view.hidden = view.dataset.view !== name; });
  if (!dialog.open) dialog.showModal();
  if (name === 'roulette') drawWheel();
  if (name === 'grade') renderGradeTable();
  if (name === 'middle') renderMiddleIncome();
  if (name === 'duty' || name === 'devotional') loadHolidayCalendar(name);
}
$$('[data-open-tool], .tool-card').forEach((button) => button.addEventListener('click', () => openTool(button.dataset.openTool || button.dataset.tool)));
$$('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

// Age and school grade calculators.
$('#age-reference').value = toDateInput(today);
$('#age-birthdate').max = toDateInput(today);
$('#age-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const birth = parseDate($('#age-birthdate').value), reference = parseDate($('#age-reference').value), result = $('#age-result');
  if (!birth || !reference || birth > reference) { result.textContent = '생년월일이 기준일보다 늦지 않은지 확인해 주세요.'; return; }
  let age = reference.getFullYear() - birth.getFullYear();
  if (reference.getMonth() < birth.getMonth() || (reference.getMonth() === birth.getMonth() && reference.getDate() < birth.getDate())) age--;
  const yearAge = reference.getFullYear() - birth.getFullYear();
  const koreanAge = yearAge + 1;
  let nextBirthday = new Date(reference.getFullYear(), birth.getMonth(), birth.getDate());
  if (nextBirthday < new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())) nextBirthday = new Date(reference.getFullYear() + 1, birth.getMonth(), birth.getDate());
  const left = dayDiff(new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()), nextBirthday);
  result.innerHTML = `<div class="age-tile"><small>만 나이</small><strong>${age}세</strong></div><div class="age-tile"><small>연 나이</small><strong>${yearAge}세</strong></div><div class="age-tile"><small>세는나이 (참고)</small><strong>${koreanAge}세</strong></div><div class="age-tile"><small>다음 생일까지</small><strong>${left === 0 ? '오늘!' : `${left}일`}</strong></div>`;
});
function renderGradeTable() {
  const year = new Date().getFullYear();
  $('#grade-year').textContent = `${year}년`;
  const groups = [
    {school:'초등학교',start:1,count:6},
    {school:'중학교',start:7,count:3},
    {school:'고등학교',start:10,count:3}
  ];
  $('#grade-table').innerHTML = groups.map((group) => `<section class="grade-school-card"><h4>${group.school}</h4><table><thead><tr><th>학년</th><th>출생연도</th></tr></thead><tbody>${Array.from({length:group.count},(_,index) => {
    const grade = index + 1;
    const schoolGrade = group.start + index;
    return `<tr><th scope="row">${grade}학년</th><td>${year - schoolGrade - 6}년생</td></tr>`;
  }).join('')}</tbody></table></section>`).join('');
}

renderGradeTable();
window.setInterval(() => {
  if ($('#grade-year').textContent !== `${new Date().getFullYear()}년`) renderGradeTable();
}, 60 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderGradeTable(); });

// Median-income reference and health-insurance premium comparison.
const medianIncomeAmounts = {
  2026:[2564238,4199292,5359036,6494738,7556719,8555952,9515150],
  2027:[2736042,4480645,5718091,6929885,8063019,9129201,10152665]
};
const incomePercentages = [...Array.from({length:29},(_,index) => 20 + index * 10),32,48,75].sort((a,b) => a-b);
// 2026 100% 기준표: 장기요양보험료 제외, 가입 유형별 공식 공표액.
const insurance100 = {
  workplace:[92428,151148,195073,236378,274221,309777,348913,390974,432308,457613],
  regional:[20073,83625,137279,172901,220149,264935,308246,357158,404529,435046],
  mixed:[null,152775,197469,240050,279461,318043,360410,410439,457613,490306]
};
const insurancePercentages = Array.from({length:29},(_,index) => 20 + index * 10);
const insuranceTypeLabels = {workplace:'직장가입자',regional:'지역가입자',mixed:'혼합'};
function getMedianIncome(year, household) {
  const amounts = medianIncomeAmounts[year];
  if (!amounts || household < 1) return null;
  if (household <= 7) return amounts[household - 1];
  return amounts[6] + (amounts[6] - amounts[5]) * (household - 7);
}
function renderMiddleIncome() {
  const year = Number($('#middle-year').value || 2026);
  const household = Number($('#middle-household').value || 1);
  const baseline = getMedianIncome(year,household);
  const rows = incomePercentages.map((percentage) => `<tr${percentage === 100 ? ' class="median-base-row"' : ''}><th scope="row">${percentage}%</th><td>${formatWon(baseline * percentage / 100)}</td></tr>`).join('');
  $('#middle-income-table').innerHTML = `<table><thead><tr><th scope="col">기준 비율</th><th scope="col">월 기준액</th></tr></thead><tbody>${rows}</tbody></table><p class="middle-table-caption">${year}년 · ${household}인 가구 · 100% 기준 ${formatWon(baseline)}</p>`;
  updateMonthlyIncomeRatio();
}
function updateMonthlyIncomeRatio() {
  const amount = Number($('#middle-monthly-income').value);
  const baseline = getMedianIncome(Number($('#middle-year').value),Number($('#middle-household').value));
  const result = $('#middle-income-result');
  if (!$('#middle-monthly-income').value || !Number.isFinite(amount) || amount < 0 || !baseline) {
    result.textContent = '월소득을 입력하면 선택한 가구의 기준 중위소득 대비 비율을 계산합니다.';
    return;
  }
  const percentage = amount / baseline * 100;
  result.innerHTML = `입력한 월소득은 기준 중위소득의 <strong>${percentage.toFixed(1)}%</strong>입니다. <span>(${formatWon(amount)} ÷ ${formatWon(baseline)})</span>`;
}
function compareHealthInsurance() {
  const household = Number($('#middle-household').value);
  const type = $('#insurance-type').value;
  const inputs = $$('.insurance-payment');
  const result = $('#insurance-result');
  if (inputs.some((input) => input.value === '' || !Number.isFinite(Number(input.value)) || Number(input.value) < 0)) {
    result.textContent = '건강보험료 3개월 금액을 모두 입력해 주세요.';
    return;
  }
  const baseThreshold = insurance100[type][household - 1];
  const table = $('#insurance-percent-table');
  if (baseThreshold == null) {
    result.textContent = '2026년 100% 기준표에 1인 가구 혼합가입자 값이 없습니다. 실제 가입 유형과 사업별 기준을 주민센터 또는 담당 기관에 확인해 주세요.';
    table.hidden = true;
    return;
  }
  const values = inputs.map((input) => Number(input.value));
  const average = values.reduce((sum,value) => sum + value,0) / values.length;
  const estimatedPercent = average / baseThreshold * 100;
  result.innerHTML = `<strong>예상 기준 중위소득 ${estimatedPercent.toFixed(1)}% · 3개월 평균 ${formatWon(average)}</strong><p>${household}인 가구 ${insuranceTypeLabels[type]}의 100% 기준 보험료 ${formatWon(baseThreshold)}를 기준으로 비례 환산한 값입니다.</p><span>사업별 공식 판정표가 아니며, 지역가입자의 재산·소득 구성과 가구별 보험료 산정 방식에 따라 실제 비율은 달라질 수 있습니다.</span>`;
  const rows = insurancePercentages.map((percentage) => {
    const estimatedPremium = Math.round(baseThreshold * percentage / 100);
    const current = Math.abs(estimatedPercent - percentage) < 5 ? ' class="insurance-estimate-near"' : '';
    return `<tr${current}><th scope="row">${percentage}%</th><td>${formatWon(estimatedPremium)}</td></tr>`;
  }).join('');
  table.innerHTML = `<h5>비율별 예상 보험료 참고표</h5><p>100% 기준 보험료에 비율을 곱한 단순 추정표입니다. 평균 ${formatWon(average)}은 약 ${estimatedPercent.toFixed(1)}% 지점입니다.</p><div class="insurance-percent-table-scroll"><table><thead><tr><th scope="col">기준 비율</th><th scope="col">예상 보험료</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  table.hidden = false;
}
$('#middle-year').addEventListener('change',renderMiddleIncome);
$('#middle-household').innerHTML = Array.from({length:10},(_,index) => `<option value="${index + 1}">${index + 1}인 가구</option>`).join('');
$('#middle-household').value = '1';
$('#middle-household').addEventListener('change',() => { renderMiddleIncome(); $('#insurance-result').textContent = '가구원 수가 바뀌었습니다. 보험료를 다시 비교해 주세요.'; $('#insurance-percent-table').hidden = true; });
$('#middle-monthly-income').addEventListener('input',updateMonthlyIncomeRatio);
$('#compare-insurance').addEventListener('click',compareHealthInsurance);
$('#insurance-type').addEventListener('change',() => { $('#insurance-result').textContent = '가입 유형이 바뀌었습니다. 보험료를 다시 비교해 주세요.'; $('#insurance-percent-table').hidden = true; });
$$('.insurance-payment').forEach((input) => input.addEventListener('input',() => {
  $('#insurance-percent-table').hidden = true;
  $('#insurance-result').textContent = '보험료 입력값이 바뀌었습니다. 3개월을 모두 입력한 뒤 다시 비교해 주세요.';
}));

// Activity plan builder, following the user's eight-section sample form.
const PLAN_STORAGE_KEY = 'songpa-activity-plan-v1';
const planKeys = ['title','project','date','place','content','target','overviewBudget','purpose','goals','evaluationMethod1','evaluationTool1','evaluationIndicator1','evaluationMethod2','evaluationTool2','evaluationIndicator2'];
const planRowConfig = {
  schedules:{container:'schedule-plan-rows',storage:'schedules',className:'schedule-editor',fields:[{key:'time',label:'시간',placeholder:'예: 09:50'},{key:'topic',label:'주제',placeholder:'예: 집합'},{key:'details',label:'세부내용',placeholder:'진행 내용을 입력'},{key:'note',label:'비고',placeholder:'비고'}]},
  attendees:{container:'attendee-plan-rows',storage:'attendees',className:'attendee-editor',fields:[{key:'order',label:'순',placeholder:'1'},{key:'name',label:'이름',placeholder:'이름'},{key:'relation',label:'관계',placeholder:'예: 보호자(모)'},{key:'gender',label:'성별',placeholder:'예: 여'}]},
  staff:{container:'staff-plan-rows',storage:'staff',className:'staff-editor',fields:[{key:'name',label:'이름',placeholder:'이름'},{key:'position',label:'담당부서/직위',placeholder:'예: 복지사업팀/팀장'},{key:'role',label:'수행역할',placeholder:'예: 사업 전체 슈퍼비전'}]},
  budgets:{container:'activity-budget-rows',storage:'budgets',className:'budget-editor',fields:[{key:'category',label:'항목',placeholder:'예: 사업비'},{key:'item',label:'품목',placeholder:'예: 재료비'},{key:'details',label:'산출내역',placeholder:'예: 15,000원 × 9명',wide:true},{key:'amount',label:'금액 (원)',placeholder:'0',type:'number'},{key:'note',label:'비고',placeholder:'예: 카드 결제'}]}
};
let currentPlanStage = 1;
let planState = {};
function readPlanStorage() {
  try { const stored = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) || '{}'); return stored && typeof stored === 'object' ? stored : {}; }
  catch { return {}; }
}
function readPlanRows(kind) {
  const config = planRowConfig[kind];
  return $$('.plan-data-row', $(`#${config.container}`)).map((row) => Object.fromEntries(config.fields.map((field) => [field.key,$(`[data-row-key="${field.key}"]`,row).value.trim()])));
}
function addPlanRow(kind, values = {}) {
  const config = planRowConfig[kind], container = $(`#${config.container}`);
  const row = document.createElement('div'); row.className = `plan-data-row ${config.className}`;
  config.fields.forEach((field) => {
    const input = document.createElement('input');
    input.type = field.type || 'text'; input.placeholder = field.placeholder; input.value = values[field.key] ?? '';
    input.dataset.rowKey = field.key; input.setAttribute('aria-label',field.label);
    if (field.type === 'number') { input.min = '0'; input.step = '1000'; }
    row.append(input);
  });
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-budget'; remove.dataset.removePlanRow = kind; remove.textContent = '×'; remove.setAttribute('aria-label','행 삭제'); row.append(remove);
  container.append(row);
}
function collectPlan() {
  const values = {};
  $$('.plan-field').forEach((field) => { values[field.dataset.key] = field.value; });
  Object.keys(planRowConfig).forEach((kind) => { values[planRowConfig[kind].storage] = readPlanRows(kind); });
  return values;
}
function savePlan() {
  planState = collectPlan();
  try { localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planState)); } catch { /* Storage may be disabled; editing still works in the current page. */ }
  renderPlanPreview(); updateBudgetTotal();
}
function planCell(value) { return escapeHtml(value || '—').replace(/\n/g,'<br>'); }
function previewTable(headers, rows, colspan = headers.length) {
  const body = rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${planCell(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${colspan}" class="preview-empty">아직 입력하지 않았습니다.</td></tr>`;
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
}
function rowsWithContent(rows, keys) { return rows.filter((row) => keys.some((key) => String(row[key] || '').trim())); }
function renderPlanPreview() {
  const p = collectPlan();
  const schedules = rowsWithContent(p.schedules, ['time','topic','details','note']);
  const attendees = rowsWithContent(p.attendees, ['name','relation','gender']);
  const staff = rowsWithContent(p.staff, ['name','position','role']);
  const budgets = rowsWithContent(p.budgets, ['category','item','details','amount','note']);
  const budgetTotal = budgets.reduce((sum,row) => sum + (Number(row.amount) || 0),0);
  const overview = [['사업명',p.project],['일시',p.date],['장소',p.place],['내용',p.content],['대상',p.target],['예산',p.overviewBudget ? formatWon(p.overviewBudget) : '']];
  const goals = String(p.goals || '').split(/\r?\n/).map((goal) => goal.trim()).filter(Boolean);
  const goalMarkup = goals.length ? `<ol>${goals.map((goal) => `<li>${escapeHtml(goal)}</li>`).join('')}</ol>` : '<span class="preview-empty">아직 입력하지 않았습니다.</span>';
  const budgetTable = previewTable(['항목','품목','산출내역','금액 (원)','비고'],budgets.map((row) => [row.category,row.item,row.details,row.amount ? formatWon(row.amount) : '',row.note]));
  const evaluationRows = [1,2].map((index) => [index, p[`evaluationMethod${index}`], p[`evaluationTool${index}`], p[`evaluationIndicator${index}`]]);
  const sections = [
    `<h5>1. 개요</h5>${previewTable(['항목','내용'],overview)}`,
    `<h5>2. 목적</h5><p>${planCell(p.purpose)}</p>`,
    `<h5>3. 목표</h5>${goalMarkup}`,
    `<h5>4. 세부진행내용</h5>${previewTable(['시간','주제','세부내용','비고'],schedules.map((row) => [row.time,row.topic,row.details,row.note]))}`,
    `<h5>5. 참가자명단</h5>${previewTable(['순','이름','관계','성별'],attendees.map((row,index) => [row.order || String(index+1),row.name,row.relation,row.gender]))}`,
    `<h5>6. 업무분장</h5>${previewTable(['이름','담당부서/직위','수행역할'],staff.map((row) => [row.name,row.position,row.role]))}`,
    `<h5>7. 예산</h5>${budgetTable}<p class="preview-total">합계　${escapeHtml(formatWon(budgetTotal))}</p>`,
    `<h5>8. 평가</h5>${previewTable(['평가','평가방법','평가도구','평가지표'],evaluationRows)}`
  ];
  $('#plan-preview-content').innerHTML = `<h4>${escapeHtml(p.title || '사업 계획서 초안')}</h4>${sections.join('')}`;
}
function updateBudgetTotal() {
  const total = readPlanRows('budgets').reduce((sum,row) => sum + (Number(row.amount) || 0),0);
  $('#budget-total-display').textContent = formatWon(total);
}
function setPlanStage(stage) {
  currentPlanStage = Math.min(3, Math.max(1, stage));
  $$('[data-stage]').forEach((element) => { element.hidden = Number(element.dataset.stage) !== currentPlanStage; });
  $$('.proposal-step').forEach((button) => {
    const number = Number(button.dataset.stepTarget);
    button.classList.toggle('active', number === currentPlanStage);
    button.classList.toggle('done', number < currentPlanStage);
    if (number === currentPlanStage) button.setAttribute('aria-current','step'); else button.removeAttribute('aria-current');
  });
  $('#plan-step-label').textContent = `${currentPlanStage} / 3 단계`;
  $('#plan-prev').disabled = currentPlanStage === 1;
  $('#plan-next').textContent = currentPlanStage === 3 ? '처음으로 돌아가기' : '다음 단계 →';
  if (currentPlanStage === 3) savePlan();
}
function planToText() {
  const p = collectPlan();
  const describeRows = (rows, keys) => rowsWithContent(rows,keys).map((row,index) => `${index+1}. ${keys.map((key) => row[key] || '').join(' | ')}`).join('\n') || '-';
  const budgets = rowsWithContent(p.budgets,['category','item','details','amount','note']);
  const total = budgets.reduce((sum,row) => sum + (Number(row.amount) || 0),0);
  const evaluations = [1,2].map((index) => `${index}. 평가방법: ${p[`evaluationMethod${index}`] || ''}\n   평가도구: ${p[`evaluationTool${index}`] || ''}\n   평가지표: ${p[`evaluationIndicator${index}`] || ''}`).join('\n');
  return `${p.title || '사업 계획서'}\n\n1. 개요\n사업명: ${p.project || ''}\n일시: ${p.date || ''}\n장소: ${p.place || ''}\n내용: ${p.content || ''}\n대상: ${p.target || ''}\n예산: ${p.overviewBudget ? formatWon(p.overviewBudget) : ''}\n\n2. 목적\n${p.purpose || ''}\n\n3. 목표\n${String(p.goals || '').split(/\r?\n/).filter((line) => line.trim()).map((line,index) => `${index+1}. ${line}`).join('\n') || '-'}\n\n4. 세부진행내용\n${describeRows(p.schedules,['time','topic','details','note'])}\n\n5. 참가자명단\n${describeRows(p.attendees,['order','name','relation','gender'])}\n\n6. 업무분장\n${describeRows(p.staff,['name','position','role'])}\n\n7. 예산\n${describeRows(budgets,['category','item','details','amount','note'])}\n합계: ${formatWon(total)}\n\n8. 평가\n${evaluations}\n`;
}
function setSharedAIStatus(message,connected=false) {
  $('#shared-ai-status').textContent = message;
  const featureStatus = connected ? '기관 공용 Groq 키 인증 확인됨' : '기관 공용 Groq 연결을 확인해 주세요';
  $('#plan-api-key-status').textContent = featureStatus;
  $('#welfare-api-key-status').textContent = featureStatus;
}
async function checkSharedAIConnection() {
  const button = $('#check-shared-ai');
  button.disabled = true;
  setSharedAIStatus('기관 서버에 등록된 Groq 키를 확인하고 있습니다…');
  try {
    if (location.protocol === 'file:') throw Error('현재 파일을 직접 열었습니다. 기관에서 배포한 웹 주소로 접속해 주세요.');
    const response = await fetch('/api/validate-key?provider=groq',{cache:'no-store'});
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      if (response.status === 404 || response.status === 405) throw Error('기관 공용 키 확인 API가 배포되지 않았습니다. Vercel에 프로젝트 전체를 다시 배포해 주세요.');
      throw Error(payload.error || `기관 Groq 연결 확인에 실패했습니다 (HTTP ${response.status}).`);
    }
    setSharedAIStatus('기관 공용 Groq 키 인증이 확인됐습니다. 직원은 별도 키 없이 AI 도구를 사용할 수 있습니다.',true);
  } catch (error) {
    setSharedAIStatus(error?.message || '기관 AI 서버에 연결할 수 없습니다.');
  } finally {
    button.disabled = false;
  }
}
$('#check-shared-ai').addEventListener('click',checkSharedAIConnection);
$('#plan-ai-model-badge').textContent = '기관 Groq API · GPT OSS 20B';
checkSharedAIConnection();
async function requestAIRecommendations(type, input) {
  let response;
  const provider = 'groq';
  try { response = await fetch('/api/recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,input,provider})}); }
  catch { throw Error('AI 추천 서버에 연결할 수 없습니다. 기관에서 배포한 웹 주소로 접속했는지 확인해 주세요.'); }
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) throw Error(payload.error || '추천 요청을 처리하지 못했습니다.');
  if (!payload.suggestions || typeof payload.suggestions !== 'object') throw Error('추천 결과 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.');
  return payload.suggestions;
}
function showPlanAISuggestions(suggestions) {
  planAISuggestions = suggestions;
  $('#plan-ai-purpose-preview').textContent = suggestions.purpose;
  suggestions.evaluations.forEach((evaluation,index) => {
    const number = index + 1;
    $(`#plan-ai-method-${number}-preview`).textContent = evaluation.evaluationMethod;
    $(`#plan-ai-tool-${number}-preview`).textContent = evaluation.evaluationTool;
    $(`#plan-ai-indicator-${number}-preview`).textContent = evaluation.evaluationIndicator;
  });
  const list = $('#plan-ai-goals-preview'); list.replaceChildren();
  suggestions.goals.forEach((goal) => { const item = document.createElement('li'); item.textContent = goal; list.append(item); });
  $('#plan-ai-preview').hidden = false;
}
function initPlanBuilder() {
  const saved = readPlanStorage();
  const legacyEvaluationKeys = {evaluationMethod1:'evaluationMethod',evaluationTool1:'evaluationTool',evaluationIndicator1:'evaluationIndicator'};
  planKeys.forEach((key) => { const field = $(`[data-key="${key}"]`); const value = saved[key] ?? saved[legacyEvaluationKeys[key]]; if (field && value !== undefined) field.value = value; });
  Object.keys(planRowConfig).forEach((kind) => {
    const savedRows = saved[planRowConfig[kind].storage];
    (Array.isArray(savedRows) && savedRows.length ? savedRows : [{}]).forEach((row,index) => addPlanRow(kind, kind === 'attendees' && !row.order ? {...row,order:String(index+1)} : row));
  });
  $$('.plan-field').forEach((field) => field.addEventListener('input', savePlan));
  $('[data-key="project"]').addEventListener('input', () => {
    planAISuggestions = null;
    $('#plan-ai-preview').hidden = true;
    $('#plan-ai-status').textContent = '';
  });
  $('#request-plan-ai').addEventListener('click', async () => {
    const projectName = $('[data-key="project"]').value.trim();
    const status = $('#plan-ai-status'), button = $('#request-plan-ai');
    if (!$('#plan-ai-consent').checked) { status.textContent = '사업명 전송 안내를 확인하고 체크해 주세요.'; return; }
    if (!projectName) { status.textContent = '먼저 사업명을 입력해 주세요.'; return; }
    if (projectName.length > 300) { status.textContent = '사업명은 300자 이내로 입력해 주세요.'; return; }
    button.disabled = true; status.textContent = '사업명만 바탕으로 추천 초안을 만들고 있습니다…';
    try {
      const suggestions = await requestAIRecommendations('plan',projectName);
      const validEvaluations = Array.isArray(suggestions.evaluations) && suggestions.evaluations.length === 2 && suggestions.evaluations.every((evaluation) => evaluation && evaluation.evaluationMethod && evaluation.evaluationTool && evaluation.evaluationIndicator);
      if (!suggestions.purpose || !Array.isArray(suggestions.goals) || suggestions.goals.length < 2 || !validEvaluations) throw Error('추천 결과의 일부 항목이 비어 있습니다. 다시 요청해 주세요.');
      showPlanAISuggestions(suggestions);
      status.textContent = '추천을 만들었습니다. 내용을 확인하고 계획서에 적용해 주세요.';
    } catch (error) {
      status.textContent = error?.message || 'AI 추천에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    } finally {
      button.disabled = false;
    }
  });
  $('#apply-plan-ai-suggestions').addEventListener('click', () => {
    if (!planAISuggestions) return;
    const values = {
      purpose:planAISuggestions.purpose,
      goals:planAISuggestions.goals.map((goal) => `- ${goal}`).join('\n'),
      evaluationMethod1:planAISuggestions.evaluations[0].evaluationMethod,
      evaluationTool1:planAISuggestions.evaluations[0].evaluationTool,
      evaluationIndicator1:planAISuggestions.evaluations[0].evaluationIndicator,
      evaluationMethod2:planAISuggestions.evaluations[1].evaluationMethod,
      evaluationTool2:planAISuggestions.evaluations[1].evaluationTool,
      evaluationIndicator2:planAISuggestions.evaluations[1].evaluationIndicator
    };
    const fields = Object.keys(values).map((key) => $(`[data-key="${key}"]`));
    if (fields.some((field) => field.value.trim()) && !window.confirm('이미 입력한 목적·목표·평가 2개가 추천 초안으로 바뀝니다. 적용할까요?')) return;
    Object.entries(values).forEach(([key,value]) => { $(`[data-key="${key}"]`).value = value; });
    savePlan();
    $('#plan-ai-status').textContent = '추천 초안을 계획서에 적용했습니다. 내용을 검토하고 필요하면 수정해 주세요.';
  });
  $('.proposal-editor').addEventListener('input', (event) => { if (event.target.matches('[data-row-key]')) savePlan(); });
  $('.proposal-editor').addEventListener('click', (event) => {
    const add = event.target.closest('[data-add-plan-row]');
    if (add) {
      const kind = add.dataset.addPlanRow;
      const next = kind === 'attendees' ? {order:String(readPlanRows(kind).length+1)} : {};
      addPlanRow(kind,next); savePlan(); return;
    }
    const remove = event.target.closest('[data-remove-plan-row]');
    if (!remove) return;
    const kind = remove.dataset.removePlanRow, container = $(`#${planRowConfig[kind].container}`);
    remove.closest('.plan-data-row').remove();
    if (!$$('.plan-data-row',container).length) addPlanRow(kind,kind === 'attendees' ? {order:'1'} : {});
    if (kind === 'attendees') $$('.plan-data-row',container).forEach((row,index) => { const order = $('[data-row-key="order"]',row); if (order) order.value = String(index+1); });
    savePlan();
  });
  $$('.proposal-step').forEach((button) => button.addEventListener('click', () => { savePlan(); setPlanStage(Number(button.dataset.stepTarget)); }));
  $('#plan-prev').addEventListener('click', () => setPlanStage(currentPlanStage - 1));
  $('#plan-next').addEventListener('click', () => setPlanStage(currentPlanStage === 3 ? 1 : currentPlanStage + 1));
  $('#download-plan').addEventListener('click', () => {
    const title = safeName(collectPlan().title || '사업_계획서_초안');
    downloadBlob(new Blob(['\ufeff',planToText()],{type:'text/plain;charset=utf-8'}),`${title}.txt`);
  });
  $('#download-budget-xlsx').addEventListener('click', async () => {
    try {
      if (!window.XlsxPopulate) throw Error('Excel 모듈이 아직 준비되지 않았습니다. 잠시 뒤 다시 눌러주세요.');
      const p = collectPlan();
      const rows = rowsWithContent(p.budgets,['category','item','details','amount','note']);
      const total = rows.reduce((sum,row) => sum + (Number(row.amount) || 0),0);
      const values = [['항목','품목','산출내역','금액 (원)','비고'],...rows.map((row) => [row.category || '',row.item || '',row.details || '',Number(row.amount) || 0,row.note || '']),['합계','','',total,'']];
      const workbook = await XlsxPopulate.fromBlankAsync();
      workbook.sheet(0).name('예산');
      workbook.sheet(0).cell('A1').value(values);
      const bytes = await workbook.outputAsync({type:'arraybuffer'});
      downloadBlob(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`${safeName(p.title || '사업_계획서')}_예산.xlsx`);
    } catch (error) { window.alert(error?.message || '예산표를 만들지 못했습니다.'); }
  });
  $('#print-plan').addEventListener('click', () => {
    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) { window.alert('인쇄 창이 차단되었습니다. 팝업을 허용한 뒤 다시 눌러주세요.'); return; }
    const preview = $('#plan-preview-content').innerHTML;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>사업 계획서 초안</title><style>body{font:14px/1.8 system-ui,"Malgun Gothic",sans-serif;color:#333;margin:30px auto;padding:0 22px;max-width:820px}h4{font-size:24px;text-align:center;margin:0 0 18px}h5{font-size:15px;color:#dc6538;border-bottom:1px solid #f2cbb8;padding-bottom:4px;margin:22px 0 6px}p{white-space:pre-wrap;margin:4px 0}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #bdbdbd;text-align:left;padding:7px}th{background:#f6eee9}ol{padding-left:22px} @media print{body{margin:0 auto;padding:0 12mm}}</style></head><body>${preview}</body></html>`);
    printWindow.document.close(); printWindow.focus(); printWindow.print();
  });
  $('#reset-plan').addEventListener('click', () => {
    if (!window.confirm('작성 중인 사업 계획서 내용을 모두 지울까요?')) return;
    try { localStorage.removeItem(PLAN_STORAGE_KEY); } catch {}
    $$('.plan-field').forEach((field) => { field.value = ''; });
    Object.keys(planRowConfig).forEach((kind) => { $(`#${planRowConfig[kind].container}`).innerHTML = ''; addPlanRow(kind,kind === 'attendees' ? {order:'1'} : {}); });
    $('#plan-ai-consent').checked = false; $('#plan-ai-preview').hidden = true; $('#plan-ai-status').textContent = ''; planAISuggestions = null;
    setPlanStage(1); savePlan();
  });
  renderPlanPreview(); updateBudgetTotal(); setPlanStage(1);
}
initPlanBuilder();

// Independent monthly duty and devotional planners with shared holiday lookup.
const scheduleControls = {
  duty:{month:'#duty-month',status:'#duty-holiday-status',button:'#create-duty-schedule',result:'#duty-schedule-result',summary:'#duty-schedule-summary',calendar:'#duty-schedule-calendar',totals:'#duty-schedule-totals',roster:'#duty-names'},
  devotional:{month:'#devotional-month',status:'#devotional-holiday-status',button:'#create-devotional-schedule',result:'#devotional-schedule-result',summary:'#devotional-schedule-summary',calendar:'#devotional-schedule-calendar',totals:'#devotional-schedule-totals',roster:'#devotional-names'}
};
const lastScheduleRows = {duty:[],devotional:[]};
const holidayRequestIds = {duty:0,devotional:0};
const holidayYearCache = new Map();
const holidayYearLoads = new Map();
const holidaySourceByYear = new Map();
const weekdayNames = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
const weekdayShortNames = ['일','월','화','수','목','금','토'];
const holidayNameTranslations = new Map([["New Year's Day",'신정'],['Korean New Year','설날'],['Lunar New Year','설날'],['Independence Movement Day','삼일절'],["Children's Day",'어린이날'],["Buddha's Birthday",'부처님오신날'],['Memorial Day','현충일'],['Liberation Day','광복절'],['National Liberation Day','광복절'],['National Foundation Day','개천절'],['Hangeul Day','한글날'],['Hangul Day','한글날'],['Chuseok','추석'],['Christmas Day','성탄절']]);
function koreanHolidayName(name) {
  if (holidayNameTranslations.has(name)) return holidayNameTranslations.get(name);
  if (/substitute|observed/i.test(name)) return '대체공휴일';
  if (/election/i.test(name)) return '선거일';
  return name;
}
const currentMonthValue = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
for (const kind of Object.keys(scheduleControls)) {
  const monthField = $(scheduleControls[kind].month);
  monthField.value = currentMonthValue;
  monthField.min = `${today.getFullYear()-1}-01`;
  monthField.max = `${today.getFullYear()+5}-12`;
}
function parseRoster(selector) {
  return [...new Set($(selector).value.split(/\r?\n/).map((name) => name.trim()).filter(Boolean))];
}
async function fetchHolidayYear(year) {
  if (holidayYearCache.has(year)) return holidayYearCache.get(year);
  if (holidayYearLoads.has(year)) return holidayYearLoads.get(year);
  const task = (async () => {
    const sources = [
      {url:`/api/holidays?year=${year}`,label:'사이트 달력'},
      {url:`https://nagerholidays.com/api/v4/Holidays/KR/${year}`,label:'공개 달력'},
      {url:`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`,label:'공개 달력'}
    ];
    const errors = [];
    for (const source of sources) {
      try {
        const response = await fetch(source.url,{cache:'no-store'});
        let payload = {};
        try { payload = await response.json(); } catch {}
        if (!response.ok) throw Error(payload.error || `HTTP ${response.status}`);
        const records = Array.isArray(payload) ? payload : payload.holidays;
        if (!Array.isArray(records) || !records.length) throw Error('공휴일 응답이 비어 있습니다.');
        const byDate = new Map();
        records.forEach((item) => {
          const types = item.holidayTypes || item.types;
          if (Array.isArray(types) && !types.includes('Public')) return;
          if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return;
          const name = koreanHolidayName(String(item.localName || item.name || '공휴일'));
          byDate.set(item.date,byDate.has(item.date) ? `${byDate.get(item.date)} · ${name}` : name);
        });
        const normalized = [...byDate].map(([date,name]) => ({date,name})).sort((a,b) => a.date.localeCompare(b.date));
        if (!normalized.length) throw Error('대한민국 공휴일을 찾지 못했습니다.');
        holidaySourceByYear.set(year,source.label);
        holidayYearCache.set(year,normalized);
        return normalized;
      } catch (error) { errors.push(error?.message || '연결 실패'); }
    }
    throw Error(`공휴일 달력을 불러오지 못했습니다. 인터넷 연결을 확인하거나 잠시 후 다시 시도해 주세요. (${errors.join(' · ')})`);
  })();
  holidayYearLoads.set(year,task);
  try { return await task; } finally { holidayYearLoads.delete(year); }
}
async function loadHolidayCalendar(kind) {
  const control = scheduleControls[kind];
  const month = $(control.month).value;
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  const year = Number(month.slice(0,4));
  const requestId = ++holidayRequestIds[kind];
  $(control.button).disabled = true;
  $(control.status).textContent = `${year}년 공휴일을 불러오는 중…`;
  try {
    const holidays = await fetchHolidayYear(year);
    if (requestId !== holidayRequestIds[kind] || $(control.month).value !== month) return;
    const suffix = holidaySourceByYear.get(year) === '공개 달력' ? ' · 공개 달력 연결' : '';
    $(control.status).textContent = `${year}년 공휴일 ${holidays.length}일 · 일정에서 미배정${suffix}`;
    $(control.button).disabled = false;
  } catch (error) {
    if (requestId !== holidayRequestIds[kind]) return;
    $(control.status).textContent = error?.message || '공휴일 데이터를 불러오지 못했습니다. 다시 시도해 주세요.';
    $(control.button).disabled = true;
  }
}
function fairlyAssign(names, totals, cursorState, count, previous) {
  const assigned = [];
  for (let slot = 0; slot < count; slot++) {
    const ordered = names.map((name,index) => ({name,index,distance:(index-cursorState.value+names.length)%names.length}))
      .filter((person) => !assigned.includes(person.name))
      .sort((a,b) => totals.get(a.name)-totals.get(b.name) || a.distance-b.distance);
    const withoutPrevious = ordered.filter((person) => !previous.has(person.name));
    const choice = (withoutPrevious.length ? withoutPrevious : ordered)[0];
    assigned.push(choice.name);
    totals.set(choice.name,totals.get(choice.name)+1);
    cursorState.value = (choice.index+1)%names.length;
  }
  return assigned;
}
function buildMonthlySchedule(kind,year,monthNumber,holidays,names) {
  const totals = new Map(names.map((name) => [name,0]));
  const cursor = {value:0};
  let previous = new Set();
  const rows = [];
  const daysInMonth = new Date(year,monthNumber,0).getDate();
  for (let day=1;day<=daysInMonth;day++) {
    const date = new Date(year,monthNumber-1,day);
    const dateKey = `${year}-${String(monthNumber).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const weekdayIndex = date.getDay();
    const holiday = holidays.get(dateKey) || '';
    let assignedNames = [];
    let devotional = '';
    if (!holiday && kind === 'duty' && weekdayIndex !== 0) {
      const count = weekdayIndex === 6 ? 2 : 1;
      assignedNames = fairlyAssign(names,totals,cursor,count,previous);
      previous = new Set(assignedNames);
    } else if (!holiday && kind === 'devotional' && weekdayIndex >= 1 && weekdayIndex <= 4) {
      devotional = fairlyAssign(names,totals,cursor,1,previous)[0];
      previous = new Set([devotional]);
    } else if (!holiday && kind === 'devotional' && weekdayIndex === 5) devotional = '파트너십';
    rows.push({date:dateKey,weekday:weekdayNames[weekdayIndex],weekdayIndex,holiday,names:assignedNames,devotional});
  }
  return {rows,totals};
}
function renderScheduleCalendar(kind,year,monthNumber,rows) {
  const firstDay = new Date(year,monthNumber-1,1).getDay();
  const daysInMonth = new Date(year,monthNumber,0).getDate();
  const cells = [];
  for (let i=0;i<firstDay;i++) cells.push('<div class="schedule-calendar-empty" aria-hidden="true"></div>');
  rows.forEach((row) => {
    const holidayLabel = row.holiday ? `<span class="calendar-holiday-name">${escapeHtml(row.holiday)}</span>` : '';
    const assignmentLine = kind === 'duty'
      ? row.names.length ? `<span class="calendar-duty"><b>당직</b>${row.names.map(escapeHtml).join(' · ')}</span>` : `<span class="calendar-no-duty"><b>당직</b>${row.holiday || row.weekdayIndex === 0 ? '없음' : '—'}</span>`
      : row.devotional ? `<span class="calendar-devotional"><b>경건회</b>${escapeHtml(row.devotional)}</span>` : `<span class="calendar-no-duty"><b>경건회</b>${row.holiday || row.weekdayIndex === 0 || row.weekdayIndex === 6 ? '없음' : '—'}</span>`;
    cells.push(`<article class="schedule-day${row.holiday?' is-holiday':''}${row.weekdayIndex===0?' is-sunday':''}"><div class="schedule-day-top"><strong>${Number(row.date.slice(-2))}</strong><span>${weekdayShortNames[row.weekdayIndex]}</span></div>${holidayLabel}${assignmentLine}</article>`);
  });
  const trailing = (7-(firstDay+daysInMonth)%7)%7;
  for (let i=0;i<trailing;i++) cells.push('<div class="schedule-calendar-empty" aria-hidden="true"></div>');
  $(scheduleControls[kind].calendar).innerHTML = `<div class="schedule-weekdays">${weekdayShortNames.map((day,index)=>`<span class="${index===0?'sunday-text':''}">${day}</span>`).join('')}</div><div class="schedule-calendar-grid">${cells.join('')}</div>`;
}
function renderScheduleTotals(kind,names,totals) {
  const label = kind === 'duty' ? '당직' : '경건회';
  $(scheduleControls[kind].totals).innerHTML = names.map((name) => `<span class="person-total"><i>${label}</i>${escapeHtml(name)}<b>${totals.get(name)}회</b></span>`).join('');
}
for (const kind of Object.keys(scheduleControls)) {
  const control = scheduleControls[kind];
  $(control.month).addEventListener('change',() => { $(control.result).hidden = true; loadHolidayCalendar(kind); });
  $(kind === 'duty' ? '#duty-form' : '#devotional-form').addEventListener('submit',(event) => {
    event.preventDefault();
    const month = $(control.month).value;
    const [year,monthNumber] = month.split('-').map(Number);
    const names = parseRoster(control.roster);
    if (!month) { window.alert('일정 월을 선택해 주세요.'); return; }
    if (!holidayYearCache.has(year)) { window.alert('공휴일 달력이 준비될 때까지 잠시 기다려 주세요.'); return; }
    if (kind === 'duty' && names.length < 2) { window.alert('토요일 당직 2명을 배정하려면 당직자 이름을 2명 이상 입력해 주세요.'); return; }
    if (kind === 'devotional' && !names.length) { window.alert('경건회 순서자를 한 명 이상 입력해 주세요.'); return; }
    const holidays = new Map(holidayYearCache.get(year).map((holiday) => [holiday.date,holiday.name]));
    const {rows,totals} = buildMonthlySchedule(kind,year,monthNumber,holidays,names);
    lastScheduleRows[kind] = rows;
    const holidayCount = rows.filter((row) => row.holiday).length;
    if (kind === 'duty') {
      const assignmentCount = rows.reduce((sum,row) => sum + row.names.length,0);
      $(control.summary).textContent = `${year}년 ${monthNumber}월 · 당직 ${assignmentCount}명 배정 · 공휴일 ${holidayCount}일 미배정`;
    } else {
      const devotionalCount = rows.filter((row) => row.devotional && row.devotional !== '파트너십').length;
      const partnershipCount = rows.filter((row) => row.devotional === '파트너십').length;
      $(control.summary).textContent = `${year}년 ${monthNumber}월 · 경건회 ${devotionalCount}회 · 파트너십 ${partnershipCount}회 · 공휴일 ${holidayCount}일 미배정`;
    }
    renderScheduleCalendar(kind,year,monthNumber,rows);
    renderScheduleTotals(kind,names,totals);
    $(control.result).hidden = false;
  });
  loadHolidayCalendar(kind);
}
function downloadSchedule(kind) {
  const rows = lastScheduleRows[kind];
  if (!rows.length) return;
  const quote = (value) => `"${String(value).replace(/"/g,'""')}"`;
  const headers = kind === 'duty' ? ['날짜','요일','공휴일','당직자'] : ['날짜','요일','공휴일','경건회·파트너십'];
  const lines = [headers,...rows.map((row) => kind === 'duty' ? [row.date,row.weekday,row.holiday,row.names.join(' / ')] : [row.date,row.weekday,row.holiday,row.devotional])].map((row) => row.map(quote).join(',')).join('\r\n');
  downloadBlob(new Blob(['\ufeff',lines],{type:'text/csv;charset=utf-8'}),kind === 'duty' ? '당직_일정.csv' : '경건회_일정.csv');
}
$('#download-duty-schedule').addEventListener('click',() => downloadSchedule('duty'));
$('#download-devotional-schedule').addEventListener('click',() => downloadSchedule('devotional'));

// Wheel roulette, inspired by the supplied Marble Roulette reference.
const rouletteCanvas = $('#roulette-canvas');
const wheelContext = rouletteCanvas.getContext('2d');
let wheelRotation = 0; let wheelSpinning = false; let lastWinner = '';
let lastWheelItems = [];
const wheelPalette = ['#3b82a0','#5d9b72','#d87855','#927ab5','#d5a843','#398d88','#bf6272','#5c7dc4','#a17b47','#62a879','#cf7542','#7476aa'];
function parseWheelItems() {
  const raw = $('#roulette-options').value.split(/[\n,]/).map((piece) => piece.trim()).filter(Boolean);
  const items = [];
  for (const part of raw) {
    const weighted = part.match(/^(.+?)\s*\*\s*(\d+)$/);
    const name = (weighted ? weighted[1] : part).trim();
    const quantity = weighted ? Math.max(1,Math.min(100,Number(weighted[2]) || 1)) : 1;
    for (let i=0;i<quantity;i++) { if (items.length >= 180) return items; items.push(name); }
  }
  return items;
}
function drawWheel() {
  if (!wheelContext || !rouletteCanvas) return;
  const ctx = wheelContext, size = rouletteCanvas.width, center = size/2, radius = center-9;
  const items = parseWheelItems(); lastWheelItems = items;
  ctx.clearRect(0,0,size,size);
  ctx.beginPath(); ctx.arc(center,center,radius,0,Math.PI*2); ctx.fillStyle='#f1f5f1'; ctx.fill();
  if (!items.length) {
    ctx.beginPath(); ctx.arc(center,center,radius-4,0,Math.PI*2); ctx.fillStyle='#e9f0ea'; ctx.fill();
    ctx.fillStyle='#708078'; ctx.font='600 22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('항목을 입력하세요',center,center); return;
  }
  const slice = Math.PI*2/items.length; const start = -Math.PI/2;
  items.forEach((name,index) => {
    const from = start+slice*index, to=from+slice;
    ctx.beginPath(); ctx.moveTo(center,center); ctx.arc(center,center,radius-3,from,to); ctx.closePath();
    ctx.fillStyle=wheelPalette[index%wheelPalette.length]; ctx.fill(); ctx.strokeStyle='#ffffffd9'; ctx.lineWidth=2; ctx.stroke();
    ctx.save(); ctx.translate(center,center); ctx.rotate(from+slice/2); ctx.textAlign='right'; ctx.textBaseline='middle';
    const fontSize = items.length>28?12:items.length>18?14:16; ctx.font=`700 ${fontSize}px sans-serif`; ctx.fillStyle='#fff';
    const label = name.length>15?`${name.slice(0,14)}…`:name; ctx.fillText(label,radius-24,0,Math.max(55,radius*.55)); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(center,center,radius,0,Math.PI*2); ctx.strokeStyle='#ffffff'; ctx.lineWidth=8; ctx.stroke();
}
function randomIndex(length) {
  if (length <= 1) return 0;
  const max = 0x100000000; const limit = Math.floor(max/length)*length; const buffer = new Uint32Array(1); let value;
  do { crypto.getRandomValues(buffer); value = buffer[0]; } while (value >= limit);
  return value % length;
}
function updateWheelHistory(winner) {
  const history = $('#roulette-history');
  if (history.dataset.results === undefined) history.dataset.results = '';
  const records = history.dataset.results ? JSON.parse(history.dataset.results) : [];
  records.unshift(winner); const limited = records.slice(0,5); history.dataset.results = JSON.stringify(limited);
  history.innerHTML = `<b>최근 결과</b>${limited.map((item,index)=>`<span>${index+1}. ${escapeHtml(item)}</span>`).join('')}`;
}
$('#roulette-options').addEventListener('input', () => {
  if (wheelSpinning) return;
  wheelRotation=0; rouletteCanvas.style.transition='none'; rouletteCanvas.style.transform='rotate(0deg)';
  requestAnimationFrame(() => { rouletteCanvas.style.transition=''; drawWheel(); });
});
$('#spin-roulette').addEventListener('click', () => {
  if (wheelSpinning) return;
  const items = parseWheelItems();
  if (items.length < 2) { window.alert('룰렛에 넣을 항목을 2개 이상 입력해 주세요.'); return; }
  const index = randomIndex(items.length); const slice=360/items.length; const targetMod=(( -90 - (-90 + index*slice + slice/2))%360+360)%360;
  const currentMod=((wheelRotation%360)+360)%360; const offset=((targetMod-currentMod)+360)%360;
  wheelRotation += 360*7 + offset;
  lastWinner = items[index]; wheelSpinning=true;
  $('#spin-roulette').disabled=true; $('#remove-winner').disabled=true; $('#roulette-winner').textContent='룰렛을 돌리는 중…';
  const finish = () => {
    if (!wheelSpinning) return;
    wheelSpinning=false; $('#spin-roulette').disabled=false; $('#remove-winner').disabled=false;
    $('#roulette-winner').textContent=`🎉 당첨 결과: ${lastWinner}`; updateWheelHistory(lastWinner);
    rouletteCanvas.removeEventListener('transitionend',finish);
  };
  rouletteCanvas.addEventListener('transitionend',finish,{once:true});
  rouletteCanvas.style.transform=`rotate(${wheelRotation}deg)`;
  window.setTimeout(finish,5600);
});
$('#remove-winner').addEventListener('click', () => {
  if (!lastWinner || wheelSpinning) return;
  const items = parseWheelItems(); const index=items.indexOf(lastWinner);
  if (index>=0) items.splice(index,1);
  $('#roulette-options').value=items.join('\n'); lastWinner=''; $('#remove-winner').disabled=true; drawWheel();
});
drawWheel();

// Local keyword matches provide a fast fallback; the selected AI provider adds tailored contact paths. Neither decides eligibility.
const welfareServices = [
  {name:'맞춤형 급여 안내 (복지멤버십)',category:'내 상황에 맞는 제도 안내',description:'연령, 가구 구성, 경제 상황 등을 바탕으로 받을 가능성이 있는 복지서비스를 안내받을 수 있습니다. 실제 급여 결정은 별도 신청과 심사를 거칩니다.',tags:[],url:'https://www.bokjiro.go.kr/ssis-tbu/twatza/wmAplyMng/selectWmGdnc.do',link:'복지멤버십 안내'},
  {name:'기초생활보장 급여 (생계·의료·주거·교육)',category:'생활·주거·교육 지원',description:'생활이 어렵거나 주거비·의료비·교육비 부담이 큰 경우 살펴볼 수 있는 공공 급여입니다. 급여별 소득·재산 기준과 가구 특성 등을 확인해야 합니다.',tags:['생활','소득','주거','월세','집','생계','생활비','의료','병원','교육','학비','급여','저소득','기초생활','전기료','식비'],url:'https://www.bokjiro.go.kr/',link:'복지로에서 확인'},
  {name:'긴급복지 지원',category:'위기 상황 긴급 지원',description:'실직, 중한 질병, 가정폭력 등 갑작스러운 위기 사유로 생계 유지가 어려운 경우 상담해 볼 수 있습니다. 위기 사유와 소득·재산 기준을 확인합니다.',tags:['갑자기','긴급','위기','실직','소득','생활비','생계','폭력','질병','병원','퇴거','단전','단수','해고'],url:'https://www.mohw.go.kr/orgSearch.es?mid=a10604040000&org_cd=1352700',link:'129 상담 안내'},
  {name:'초·중·고 교육비 및 교육급여',category:'아동·청소년 교육 지원',description:'학생의 교육활동 지원, 방과후학교, 교육비 부담 완화와 관련된 제도를 확인할 수 있습니다. 학교와 거주 지역별 지원 내용이 다를 수 있습니다.',tags:['초등','초등학생','중학교','중학생','학생','아이','자녀','아동','교육','학교','교육비','학비','방과후','급식','교복','청소년'],url:'https://www.bokjiro.go.kr/',link:'복지로에서 확인'},
  {name:'아이돌봄 서비스·보육 지원',category:'자녀 돌봄 지원',description:'양육 공백이 있는 가정에서 이용할 수 있는 아이돌봄 서비스와 보육료·양육 관련 지원을 살펴볼 수 있습니다. 자녀 연령과 가구 여건에 따라 내용이 다릅니다.',tags:['아이','자녀','아동','육아','돌봄','보육','방과후','초등','맞벌이','한부모','보호자'],url:'https://www.bokjiro.go.kr/',link:'복지로에서 확인'},
  {name:'한부모가족 지원',category:'한부모 가구 지원',description:'한부모가족의 아동양육비, 교육비 등 지원을 살펴볼 수 있습니다. 자녀 연령, 소득인정액 등 세부 기준을 확인해야 합니다.',tags:['한부모','혼자 키우','싱글맘','싱글대디','이혼','자녀','아이','양육','교육비','홀로'],url:'https://www.bokjiro.go.kr/',link:'복지로에서 확인'},
  {name:'기초연금',category:'노후 생활 지원',description:'만 65세 이상 어르신을 대상으로 소득·재산을 반영해 지원 여부와 금액을 심사합니다. 신청 시기와 선정 기준을 공식 창구에서 확인해 주세요.',tags:['노인','어르신','고령','65세','기초연금','은퇴','노후','생활비','연금'],url:'https://www.bokjiro.go.kr/',link:'복지로에서 확인'},
  {name:'장애인연금·장애수당 및 활동지원',category:'장애인 생활·돌봄 지원',description:'장애 정도와 연령, 소득 수준, 일상생활 지원 필요도에 따라 연금·수당·활동지원 서비스를 확인할 수 있습니다.',tags:['장애','장애인','활동지원','보조','돌봄','의료','병원','휠체어'],url:'https://www.bokjiro.go.kr/',link:'복지로에서 확인'},
  {name:'에너지바우처 및 요금 감면',category:'에너지 비용 지원',description:'에너지 취약계층이 냉·난방 비용을 덜 수 있도록 지원하는 제도와 전기·가스 등 요금 감면을 확인할 수 있습니다. 대상 요건과 신청 기간이 있습니다.',tags:['난방','냉방','전기','가스','에너지','요금','취약','폭염','한파','생활비'],url:'https://www.bokjiro.go.kr/',link:'복지로에서 확인'},
  {name:'정신건강복지센터·지역 상담 연계',category:'마음 건강 상담',description:'우울감, 불안, 고립감 등으로 도움이 필요하면 거주지 정신건강복지센터 또는 보건복지상담센터에 상담을 요청할 수 있습니다.',tags:['우울','불안','정신','마음','고립','외로','상담','위기','자살'],url:'https://www.mohw.go.kr/',link:'상담 안내'}
];
function renderWelfareKeywordResults(query) {
  const normalized=query.toLocaleLowerCase('ko');
  const specific=welfareServices.slice(1).map((service)=>({service,score:service.tags.reduce((sum,tag)=>sum+(normalized.includes(tag.toLocaleLowerCase('ko'))?Math.min(tag.length,5):0),0)})).filter((item)=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,4);
  const results=[{service:welfareServices[0]},...specific];
  $('#welfare-results').innerHTML=results.map(({service})=>`<article class="service-result"><div><div class="service-category">${escapeHtml(service.category)}</div><h4>${escapeHtml(service.name)}</h4></div><a href="${service.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(service.link)} ↗</a><p>${escapeHtml(service.description)}</p></article>`).join('')+(specific.length?'<p class="result-note">검색 결과는 키워드와 연결되는 제도 예시입니다. 수급 가능성을 판정하지 않으며 소득·재산, 가구원, 지역, 신청 시기에 따라 달라질 수 있습니다. 공식 페이지나 주민센터에서 확인해 주세요.</p>':'<p class="result-note">상황과 직접 연결되는 항목을 찾지 못해 복지멤버십 안내를 함께 보여드립니다. 복지로에서 맞춤 안내를 신청하거나 보건복지상담센터 129에 문의해 보세요.</p>');
}
function renderWelfareAISuggestions(suggestions) {
  const services = (Array.isArray(suggestions.services) ? suggestions.services : []).map((service) => `<article class="welfare-ai-service"><h4>${escapeHtml(service.name || '관련 서비스')}</h4><p>${escapeHtml(service.why || '')}</p><dl><dt>문의할 내용</dt><dd>${escapeHtml(service.ask || '')}</dd><dt>다음 단계</dt><dd>${escapeHtml(service.nextStep || '')}</dd></dl></article>`).join('');
  $('#welfare-ai-results').innerHTML = `<section class="welfare-ai-answer"><div class="service-category">AI가 정리한 추천 경로</div><h4>먼저 확인해 볼 수 있는 지원</h4><p class="welfare-ai-summary">${escapeHtml(suggestions.summary || '')}</p><div class="welfare-ai-service-list">${services}</div><p class="result-note">AI가 정리한 참고 초안입니다. 지원 자격, 현재 접수 여부, 검사비 지원 범위는 기관에서 확인해 주세요. 특히 종합심리검사(풀배터리) 포함 여부를 문의하세요.</p></section>`;
}
$('#welfare-form').addEventListener('submit',(event)=>{
  event.preventDefault(); const value=$('#welfare-situation').value.trim();
  if(!value){$('#welfare-situation').focus();$('#welfare-situation').setCustomValidity('상황을 입력하거나 아래 예시를 선택해 주세요.');$('#welfare-situation').reportValidity();$('#welfare-situation').setCustomValidity('');return;}
  if(!$('#welfare-ai-consent').checked){$('#welfare-ai-status').textContent='기관 Groq API로 상황이 전송됨을 확인하고 체크해 주세요.';return;}
  renderWelfareKeywordResults(value);
  const button=$('#welfare-submit'),status=$('#welfare-ai-status');
  button.disabled=true;status.textContent='상황에 맞는 복지 경로를 정리하고 있습니다…';
  $('#welfare-ai-results').innerHTML='<div class="welfare-ai-loading" role="status">추천 결과를 불러오는 중…</div>';
  requestAIRecommendations('welfare',value).then((suggestions)=>{
    if(!suggestions.summary||!Array.isArray(suggestions.services)||!suggestions.services.length)throw Error('추천 결과가 비어 있습니다. 다시 시도해 주세요.');
    renderWelfareAISuggestions(suggestions);
    status.textContent='추천을 만들었습니다. 공식 안내와 함께 확인해 주세요.';
  }).catch((error)=>{
    $('#welfare-ai-results').innerHTML='';
    status.textContent=error?.message||'AI 추천에 실패했습니다. 잠시 후 다시 시도해 주세요.';
  }).finally(()=>{button.disabled=false;});
});
$('#welfare-situation').addEventListener('input',()=>{$('#welfare-ai-results').innerHTML='';$('#welfare-ai-status').textContent='';});
$$('.prompt-examples button').forEach((button)=>button.addEventListener('click',()=>{$('#welfare-situation').value=button.dataset.example;$('#welfare-situation').dispatchEvent(new Event('input'));$('#welfare-situation').focus();}));

// Document encryption suite adapted from the supplied local HTML template.
const setCryptoStatus=(id,message,kind='')=>{const element=$(`#${id}`);element.textContent=message;element.className=`crypto-status ${kind}`;};
const lockPassword=(password,confirm,id,min=1,max=Infinity)=>{
  if(!password||!confirm)throw Error('암호를 두 칸 모두 입력하세요.');
  if(password!==confirm)throw Error('암호 확인이 일치하지 않습니다.');
  if(password.length<min)throw Error(`안전한 사용을 위해 ${min}자 이상 암호를 입력하세요.`);
  if(password.length>max)throw Error(`암호는 ${max}자 이하로 입력하세요.`);
  setCryptoStatus(id,'처리 중입니다…');
};
const runCrypto=async(buttonId,statusId,fn)=>{
  const button=$(`#${buttonId}`); button.disabled=true;
  try { await fn(); }
  catch(error) { setCryptoStatus(statusId,error?.message||'처리하지 못했습니다. 파일 형식과 암호를 확인하세요.','err'); }
  finally { button.disabled=false; }
};
$$('.crypto-tab').forEach((button)=>button.addEventListener('click',()=>{
  $$('.crypto-tab').forEach((tab)=>tab.setAttribute('aria-selected',String(tab===button)));
  $$('.crypto-panel').forEach((panel)=>{panel.hidden=panel.id!==button.dataset.cryptoTab;panel.classList.toggle('active',!panel.hidden);});
}));
const fileLabels={pdfFile:'pdfName',xlsxFile:'xlsxName',imgFile:'imgName',zipFiles:'zipName',decFile:'decName'};
Object.entries(fileLabels).forEach(([inputId,labelId])=>{
  const input=$(`#${inputId}`); input.addEventListener('change',()=>{
    const files=[...input.files]; $(`#${labelId}`).textContent=files.length?(files.length===1?files[0].name:`총 ${files.length}개 파일 선택됨: ${files.map(file=>file.name).join(', ')}`):'선택된 파일 없음';
  });
});
const isFileDrag=(event)=>event.dataTransfer&&[...event.dataTransfer.types].includes('Files');
window.addEventListener('dragover',(event)=>{if(isFileDrag(event))event.preventDefault();});
window.addEventListener('drop',(event)=>{if(isFileDrag(event))event.preventDefault();});
$$('.crypto-drop').forEach((area)=>{
  const input=$('input[type="file"]',area);
  area.addEventListener('dragenter',(event)=>{if(isFileDrag(event)){event.preventDefault();area.classList.add('dragover');}});
  area.addEventListener('dragover',(event)=>{if(isFileDrag(event)){event.preventDefault();event.dataTransfer.dropEffect='copy';area.classList.add('dragover');}});
  area.addEventListener('dragleave',(event)=>{if(!area.contains(event.relatedTarget))area.classList.remove('dragover');});
  area.addEventListener('drop',(event)=>{
    if(!isFileDrag(event))return;event.preventDefault();area.classList.remove('dragover');
    const incoming=[...event.dataTransfer.files];if(!incoming.length)return;
    const transfer=new DataTransfer();
    if(input.multiple)[...input.files,...incoming].forEach((file)=>transfer.items.add(file));else transfer.items.add(incoming[0]);
    input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
  });
});
const saveBatch=async(outputs)=>{for(let i=0;i<outputs.length;i++){downloadBlob(outputs[i].blob,outputs[i].name);if(i<outputs.length-1)await new Promise(resolve=>setTimeout(resolve,450));}};
const outputName=(file,index,total,extension)=>`${total>1?String(index+1).padStart(2,'0')+'_':''}${safeName(file.name.replace(new RegExp('\\.'+extension+'$','i'),'')+'_암호설정.'+extension)}`;
let qpdfFactoryPromise;
async function getQpdfFactory(){
  if(window.__localQpdfFactory)return window.__localQpdfFactory;
  if(!qpdfFactoryPromise){qpdfFactoryPromise=new Promise((resolve,reject)=>{
    const previous=window.Module;const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/qpdf.js';
    script.onload=()=>{const factory=window.Module!==previous?window.Module:(window.Qpdf||window.createQpdfModule||window.qpdf);if(typeof factory!=='function'){reject(Error('PDF 엔진 초기화 오류'));return;}window.__localQpdfFactory=factory;resolve(factory);};
    script.onerror=()=>reject(Error('PDF 엔진 로드 실패. 인터넷 연결을 확인하세요.'));document.head.appendChild(script);
  });}
  return qpdfFactoryPromise;
}
async function qpdfEncrypt(bytes,password,stem){
  const base='https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/';const create=await getQpdfFactory();const q=await create({locateFile:()=>base+'qpdf.wasm',noInitialRun:true});
  const input=`/${stem}.pdf`,output=`/${stem}_locked.pdf`;q.FS.writeFile(input,new Uint8Array(bytes));
  const result=q.callMain([input,'--encrypt',password,password,'256','--',output]);if(result!==0)throw Error('PDF 암호화 실패 (손상되었거나 이미 암호화된 파일일 수 있습니다)');
  return new Blob([q.FS.readFile(output)],{type:'application/pdf'});
}
async function qpdfDecrypt(bytes,password){
  const base='https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/';const create=await getQpdfFactory();const q=await create({locateFile:()=>base+'qpdf.wasm',noInitialRun:true});
  q.FS.writeFile('/dec_in.pdf',new Uint8Array(bytes));const result=q.callMain([`--password=${password}`,'/dec_in.pdf','--decrypt','/dec_out.pdf']);
  if(result!==0)throw Error('PDF 암호 해제 실패 (암호가 틀렸거나 올바른 PDF가 아닙니다)');return new Blob([q.FS.readFile('/dec_out.pdf')],{type:'application/pdf'});
}
$('#pdfGo').addEventListener('click',()=>runCrypto('pdfGo','pdfStatus',async()=>{
  const files=[...$('#pdfFile').files];if(!files.length)throw Error('PDF 파일을 하나 이상 선택하세요.');
  lockPassword($('#pdfPass').value,$('#pdfPass2').value,'pdfStatus',8);const outputs=[];
  for(let i=0;i<files.length;i++){setCryptoStatus('pdfStatus',`PDF 암호화 중 (${i+1}/${files.length})…`);outputs.push({name:outputName(files[i],i,files.length,'pdf'),blob:await qpdfEncrypt(await files[i].arrayBuffer(),$('#pdfPass').value,`input${i}`)});}
  await saveBatch(outputs);setCryptoStatus('pdfStatus',files.length>1?'완료: 암호화된 PDF 파일들을 저장했습니다.':'완료: 암호화된 PDF를 저장했습니다.','ok');
}));
$('#xlsxGo').addEventListener('click',()=>runCrypto('xlsxGo','xlsxStatus',async()=>{
  const files=[...$('#xlsxFile').files];if(!files.length)throw Error('XLSX 파일을 하나 이상 선택하세요.');
  lockPassword($('#xlsxPass').value,$('#xlsxPass2').value,'xlsxStatus',8,15);if(!window.XlsxPopulate)throw Error('Excel 모듈 로드 실패');const outputs=[];
  for(let i=0;i<files.length;i++){setCryptoStatus('xlsxStatus',`Excel 암호화 중 (${i+1}/${files.length})…`);const workbook=await XlsxPopulate.fromDataAsync(await files[i].arrayBuffer());const data=await workbook.outputAsync({password:$('#xlsxPass').value,type:'arraybuffer'});outputs.push({name:outputName(files[i],i,files.length,'xlsx'),blob:new Blob([data],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})});}
  await saveBatch(outputs);setCryptoStatus('xlsxStatus',files.length>1?'완료: 암호화된 Excel 파일들을 저장했습니다.':'완료: 암호화된 Excel 파일을 저장했습니다.','ok');
}));
$('#imgGo').addEventListener('click',()=>runCrypto('imgGo','imgStatus',async()=>{
  const files=[...$('#imgFile').files];if(!files.length)throw Error('이미지 파일을 하나 이상 선택하세요.');lockPassword($('#imgPass').value,$('#imgPass2').value,'imgStatus',8);const password=$('#imgPass').value;const mode=$('#imgMode').value;
  const embed=async(pdf,file)=>{const bytes=await file.arrayBuffer();if(file.type==='image/png'||/\.png$/i.test(file.name))return pdf.embedPng(bytes);if(file.type==='image/jpeg'||/\.(jpe?g)$/i.test(file.name))return pdf.embedJpg(bytes);throw Error(`지원하지 않는 이미지 형식입니다: ${file.name} (JPG 또는 PNG만 지원)`);};
  if(mode==='individual'){
    const outputs=[];for(let i=0;i<files.length;i++){setCryptoStatus('imgStatus',`개별 이미지 암호화 중 (${i+1}/${files.length})…`);const pdf=await PDFLib.PDFDocument.create();const image=await embed(pdf,files[i]);const page=pdf.addPage([image.width,image.height]);page.drawImage(image,{x:0,y:0,width:image.width,height:image.height});outputs.push({name:outputName(files[i],i,files.length,'pdf'),blob:await qpdfEncrypt(await pdf.save(),password,`image${i}`)});}
    await saveBatch(outputs);setCryptoStatus('imgStatus','완료: 암호화된 PDF 이미지 파일을 저장했습니다.','ok');
  }else{
    setCryptoStatus('imgStatus','이미지들을 하나의 PDF로 생성 중…');const pdf=await PDFLib.PDFDocument.create();
    for(const file of files){const image=await embed(pdf,file);const page=pdf.addPage([image.width,image.height]);page.drawImage(image,{x:0,y:0,width:image.width,height:image.height});}
    downloadBlob(await qpdfEncrypt(await pdf.save(),password,'images_combined'),'통합_이미지모음_암호화.pdf');setCryptoStatus('imgStatus','완료: 통합 암호화 PDF를 저장했습니다.','ok');
  }
}));
$('#zipGo').addEventListener('click',()=>runCrypto('zipGo','zipStatus',async()=>{
  const files=[...$('#zipFiles').files],password=$('#zipPass').value;if(!files.length)throw Error('압축할 파일을 하나 이상 선택하세요.');if(password.length<8)throw Error('ZIP 암호는 8자 이상으로 설정해 주세요.');if(!window.zip)throw Error('ZIP 모듈 로드 실패');
  setCryptoStatus('zipStatus','AES-256 암호 압축 중…');const writer=new zip.ZipWriter(new zip.BlobWriter('application/zip'),{password,encryptionStrength:3});
  for(const file of files)await writer.add(file.name,new zip.BlobReader(file),{password,encryptionStrength:3});
  const blob=await writer.close();let name=$('#zipOutName').value.trim()||'보호된_파일.zip';if(!name.toLowerCase().endsWith('.zip'))name+='.zip';downloadBlob(blob,safeName(name));setCryptoStatus('zipStatus','완료: AES-256 ZIP 암호화 파일을 저장했습니다.','ok');
}));
$('#decGo').addEventListener('click',()=>runCrypto('decGo','decStatus',async()=>{
  const file=$('#decFile').files[0],password=$('#decPass').value;if(!file)throw Error('해제할 파일을 선택하세요.');if(!password)throw Error('설정되었던 암호를 입력하세요.');const name=file.name.toLowerCase();
  if(name.endsWith('.pdf')||file.type==='application/pdf'){setCryptoStatus('decStatus','PDF 암호 해제 중…');const blob=await qpdfDecrypt(await file.arrayBuffer(),password);downloadBlob(blob,file.name.replace(/\.pdf$/i,'_암호해제.pdf'));setCryptoStatus('decStatus','완료: PDF 암호가 해제되었습니다.','ok');}
  else if(name.endsWith('.zip')||file.type==='application/zip'){
    if(!window.zip)throw Error('ZIP 모듈 로드 실패');setCryptoStatus('decStatus','ZIP 압축 해제 중…');const reader=new zip.ZipReader(new zip.BlobReader(file));const entries=await reader.getEntries({password});
    if(!entries.length){await reader.close();throw Error('압축 파일이 비어있거나 암호가 틀렸습니다.');}
    for(let i=0;i<entries.length;i++){const entry=entries[i];if(entry.directory)continue;setCryptoStatus('decStatus',`압축 해제 중 (${i+1}/${entries.length}): ${entry.filename}`);const data=await entry.getData(new zip.BlobWriter(),{password});downloadBlob(data,safeName(entry.filename.replace(/[\\/]/g,'_')));if(i<entries.length-1)await new Promise(resolve=>setTimeout(resolve,350));}
    await reader.close();setCryptoStatus('decStatus','완료: ZIP 안의 파일을 저장했습니다.','ok');
  }else throw Error('지원 형식은 암호가 설정된 PDF 또는 AES ZIP입니다.');
}));

