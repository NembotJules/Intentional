/**
 * Full onboarding, first launch → Today. Requires a fresh browser profile (the harness gives one).
 * Covers: intro story, quiz (multi-select, no auto-advance), hours slider, story beats, beliefs,
 * research, pillars, first goal (US-073), one timed habit per pillar linked to its goal, draft round-trip,
 * pledge + hold-to-sign (mentions the goal), congratulations, paywall → Today, and the saved rows.
 */
import { start, today } from './lib.mjs';

const t = await start('onboarding');
const GOAL = 'Launch side project';
const goalDeadline = today(90);
const goalDateText = (() => { const [y, m, d] = goalDeadline.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }); })();
const readDb = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const readDraft = () => t.page.evaluate(() => JSON.parse(localStorage.getItem('@intentional/onboardingDraft') || 'null'));
const { page, shot, ok, has, tap, pick, waitText } = t;
const answer = async (text) => {
  await pick(text, 700);
  await tap('Continue', 500);
};

await t.goto('/');
await waitText('Welcome to Intentional', 120000); await page.waitForTimeout(800);
await shot('welcome1'); await page.waitForTimeout(3300); await shot('welcome2'); await page.waitForTimeout(3300); await shot('welcome3');
await page.getByLabel('Get started', { exact: true }).last().click();
{ const lens = []; for (let i = 0; i < 8; i++) { const t = await page.evaluate(() => { const el = [...document.querySelectorAll('div')].find(d => d.textContent.startsWith("It's time") && d.children.length <= 2); if (!el) return ''; const spans = el.querySelectorAll('span'); return spans.length ? spans[0].childNodes[0]?.textContent ?? '' : el.textContent; }); lens.push(t.length); await page.waitForTimeout(250); } console.log('typed lengths', lens.join(',')); ok(lens[1] > 0 && lens[1] < lens[4], 'hello text types progressively'); }
ok(await has('to Intentional!'), 'hello'); await page.waitForTimeout(600); await shot('hello');
await tap("Let's go!"); ok(await has('Meet your spark'), 'meet flick'); await page.waitForTimeout(1300); await shot('meetflick'); await tap('Continue');
ok(await has('The more your hours drift'), 'drifting'); await page.waitForTimeout(800); await shot('drifting1'); await page.waitForTimeout(3200); await shot('drifting2'); await tap('Continue');
ok(await has('See for yourself!'), 'see'); await shot('see1');
{ const t = page.getByLabel("Flick's flame"); const b = await t.boundingBox();
  await page.mouse.move(b.x + b.width - 20, b.y + b.height/2); await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height/2, { steps: 6 }); await page.waitForTimeout(400); await shot('see2');
  await page.mouse.move(b.x + 5, b.y + b.height/2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(800); await shot('see3'); }
ok(await has('almost out'), 'slider drains'); await tap('Continue');
ok(await has("You're not lazy."), 'not lazy'); await page.waitForTimeout(1500); await shot('notlazy1'); await page.waitForTimeout(2500); await shot('notlazy2'); ok(await has('take your hours back'), 'not lazy text'); await tap('Good to know');
ok(await has('What should we call you?'), 'name'); ok(await has('What should we call you?'), 'name');
await page.getByPlaceholder('Your first name').fill('Clinton'); await shot('name'); await tap('Continue');
ok(await has('Nice to meet you, Clinton.'), 'meet'); await page.waitForTimeout(2900); await shot('meet'); ok(await has('Choose your pillars'), 'meet rows'); await tap('Sounds good');
ok(await has('Clinton, what brings you to Intentional?'), 'goal personalized'); await pick('Finally make progress on my goals', 900); ok(await has('Clinton, what brings you'), 'no auto-advance'); await shot('goal'); await tap('Continue');
ok(await has('What gets in the way the most?'), 'affects'); await pick('Busy all day, nothing that matters'); await pick('Distractions (phone, TV, social)'); ok(await has('What gets in the way the most?'), 'affects stays (multi)'); await shot('affects'); await tap('Continue');
ok(await has('Which best describes you?'), 'describes'); await shot('describes'); await answer('Founder / Entrepreneur');
ok(await has('Have you tried'), 'tried'); await answer("Yes, it didn't stick");
ok(await has('Did you know?'), 'did you know'); await page.waitForTimeout(3800); await shot('didyouknow'); ok(await has('47%'), 'facts new'); await tap('Continue');
ok(await has('How old are you?'), 'age'); await answer('18 – 24');
ok(await has('How many hours a day drift by?'), 'hours'); 
const track = page.getByLabel('Hours a day that drift by'); const bb = await track.boundingBox();
await page.mouse.move(bb.x + 40, bb.y + bb.height/2); await page.mouse.down();
await page.mouse.move(bb.x + 2, bb.y + bb.height/2, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(800); await shot('hours-low');
await page.mouse.move(bb.x + 4, bb.y + bb.height/2); await page.mouse.down();
await page.mouse.move(bb.x + bb.width * 0.45, bb.y + bb.height/2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1200); await shot('hours-mid');
await page.mouse.move(bb.x + bb.width * 0.45, bb.y + bb.height/2); await page.mouse.down();
await page.mouse.move(bb.x + bb.width - 2, bb.y + bb.height/2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(1200); await shot('hours-max');
await page.mouse.move(bb.x + bb.width - 4, bb.y + bb.height/2); await page.mouse.down();
await page.mouse.move(bb.x + bb.width * 0.62, bb.y + bb.height/2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
const hv = (await t.body()).match(/(\d+(?:\.\d)?)\+? Hours/); ok(hv, 'slider value ' + (hv && hv[1])); await shot('hours'); await tap('Continue');
ok(await has('Compared to a year ago'), 'compare'); await pick('About the same'); await tap('Continue', 400);
ok(await has('Personalizing your experience!'), 'calculating'); await page.waitForTimeout(1500); await shot('calculating'); await page.waitForTimeout(3000);
ok(await has('time profile is'), 'profile: ' + ((await t.body()).match(/The [A-Z][a-z]+ [A-Z][a-z]+/)||[])[0]); await page.waitForTimeout(1500); await shot('profile'); await tap('Makes sense', 300);
ok(await has('OOF'), 'oof'); await page.waitForTimeout(1600); await shot('oof'); await page.waitForTimeout(1800);
ok(await has('Days'), 'days'); await page.waitForTimeout(2600); await shot('days'); await page.waitForTimeout(1500);
ok(await has("You're on track to let"), 'years'); await page.waitForTimeout(1900); await shot('years'); await tap('Next');
ok(await has('Do you understand'), 'understand'); await page.waitForTimeout(2600); await shot('understand'); await page.waitForTimeout(1500);
ok(await has('This is your life.'), 'life grid'); await page.waitForTimeout(2600); await shot('grid1');
await page.waitForTimeout(2600); await shot('grid2'); await page.waitForTimeout(4200); await shot('grid3');
await tap('Next');
ok(await has('about the same as a year ago'), 'stagnation'); await page.waitForTimeout(3500); await shot('stagnation'); await tap('Next');
ok(await has('The good news is'), 'good news'); await page.waitForTimeout(3200); await shot('goodnews'); ok(await has('Every hour can be given a job.'), 'job');
await tap("Let's do this!"); ok(await has('more years of'), 'more years'); await shot('moreyears1'); await tap("Let's do this!", 400);
await shot('ignite0'); await page.waitForTimeout(1100); await shot('ignite1'); await page.waitForTimeout(1200); await shot('ignite2'); await page.waitForTimeout(3000); await shot('ignite3');
ok(await has('Intentional helps you live on purpose.'), 'intro typed'); await tap("Here's how");
ok(await has('At Intentional, we believe'), 'believe'); await page.waitForTimeout(1500); await shot('believe1a'); await page.waitForTimeout(1600); await shot('believe1'); ok(await has('your money, your craft'), 'belief 1');
ok(!(await has('feed one of them')), 'belief 2 not shown yet');
await page.waitForTimeout(3600); await shot('believe2'); ok(await has('feed one of them'), 'belief 2 auto-advanced');
await tap('Next', 3000); await shot('believe3'); ok(await has('tied to a pillar'), 'belief 3 via Next');
await tap('Next', 3800); await shot('believe4'); ok(await has('know where your next hour goes'), 'belief 4');
await tap('Continue');
ok(await has('Why Intentional works'), 'why works'); await page.waitForTimeout(1800); await shot('whyworks1'); await page.waitForTimeout(2800); await shot('whyworks'); ok(await has('live your life intentionally'), 'why closing'); await tap('Continue');
ok(await has('Built on behavioral science'), 'research'); await page.waitForTimeout(4600); await shot('research'); ok(await has('Psycho-Cybernetics'), 'maltz'); await tap('Continue');
ok(await has('Where will those'), 'pillars'); ok(await has('Finances'), 'pillars list'); await shot('pillars');
await page.getByPlaceholder('Add your own pillar').fill('Family'); await tap('Add pillar', 300); await shot('pillars2'); await tap('Continue');
// US-073: Navigate through new setGoal step
ok(await has('What would winning look like'), 'setGoal'); await shot('setgoal1');
// The first pillar is Finances, so the placeholder shows the first goal idea for Finances
const goalInput = page.locator('input[placeholder*="goal"], input[placeholder*="€"], input[placeholder*="Save"]').first();
await goalInput.fill(GOAL);
await pick('90 days'); await shot('setgoal2'); await tap('Next: Family', 700);
ok(await has('Add a goal for Family'), 'setGoal family'); await shot('setgoal3'); await pick('Skip for now'); await page.waitForTimeout(500); await shot('setgoal4');
ok(await has('gets every day?'), 'action'); ok(await has('Pillar 1 of 2'), 'pillar 1 of 2'); await shot('action');
{ const b = await t.body();
  ok(['5 min', '15 min', '30 min', '45 min', '60 min', '90 min'].every((c) => b.includes(c)), 'habit duration chips 5 · 15 · 30 · 45 · 60 · 90');
  ok(!/Daily habit|Just check it off|How do you track it/.test(b), 'no untimed "Daily habit" type');
  ok(b.includes('Works toward ' + GOAL), 'habit step shows the pillar goal'); }
await pick('Side project'); await pick('90 min'); await shot('action2');
// Draft round-trip: leave mid-flow on the habit step, come back, the goal (and habit) are still there.
await page.waitForTimeout(1200);
{ const d = await readDraft(); const fin = d && d.goals && d.goals.find((g) => g.name === 'Finances');
  ok(fin && fin.objective && fin.objective.title === GOAL && fin.objective.deadline === goalDeadline, 'draft stores the pending goal: ' + JSON.stringify(fin && fin.objective)); }
await page.reload({ waitUntil: 'domcontentloaded' });
await waitText('gets every day?', 180000); await page.waitForTimeout(1200); await shot('action-restored');
ok(await has('Works toward ' + GOAL), 'after reload on the habit step the goal is kept');
ok((await page.getByPlaceholder('Side project').inputValue().catch(() => '')) === 'Side project', 'after reload the habit is kept');
await tap('Next: Family', 700);
ok(await has('Pillar 2 of 2'), 'pillar 2 of 2'); await shot('action3'); await pick('Call home'); await pick('15 min'); await shot('action4');
ok(!(await has('Works toward')), 'no goal line for the pillar whose goal was skipped');
await tap('Back', 700); ok(await page.getByPlaceholder('Side project').inputValue().catch(()=>'') !== null && await has('Pillar 1 of 2'), 'back to pillar 1'); await tap('Next: Family', 700); await tap('Continue');
ok(await has('This week, Intentional will help you'), 'this week'); await page.waitForTimeout(3600); await shot('thisweek'); await tap('Continue');
ok(await has('Make it official.'), 'commit'); await page.waitForTimeout(9000); await shot('commit'); ok(await has('I, Clinton, decide'), 'pledge'); ok(await has('Finances and Family'), 'pledge pillars');
ok(await has(`${GOAL} by ${goalDateText}`), `pledge mentions the goal and its date (${goalDateText})`);
const hb = await page.getByLabel('Hold to commit').boundingBox(); await page.mouse.move(hb.x + hb.width/2, hb.y + hb.height/2); await page.mouse.down(); await page.waitForTimeout(1000); await shot('igniting'); await page.waitForTimeout(1100); await page.mouse.up(); await page.waitForTimeout(300); await shot('lit'); await page.waitForTimeout(1500);
ok(await has('Congratulations'), 'congrats'); await page.waitForTimeout(500); await shot('congrats1'); await page.waitForTimeout(2600); await shot('congrats2'); ok(await has('Day 1'), 'day 1'); ok(await has(`${GOAL} by ${goalDateText}.`), 'congrats mentions the goal'); await tap('Build my plan', 1200);
ok(await has('Building your plan'), 'loading'); await page.waitForTimeout(1800);
ok(await has('Before'), 'before/after'); await shot('beforeafter'); await tap('Continue');
ok(await has('Intentional plan'), 'plans'); await shot('plans');
await tap('Start my free trial', 3000);
ok(/today/.test(page.url()), 'landed on today: ' + page.url()); await shot('today');
const b = await t.body(); ok(!/brain rot|the feed|doom/i.test(b), 'no Brainrot copy left'); ok(b.includes('Side project'), 'action created'); ok(b.includes('Call home'), 'second pillar action created');
{ const db = await readDb();
  const fin = (db.meta_goals || []).find((g) => g.name === 'Finances'); const fam = (db.meta_goals || []).find((g) => g.name === 'Family');
  const objs = db.objectives || [];
  const goal = objs.find((o) => o.title === GOAL);
  ok(fin && goal && goal.pillar_id === fin.id, 'goal saved on the Finances pillar');
  ok(goal && goal.deadline === goalDeadline, `goal deadline = today + 90 local (${goal && goal.deadline} vs ${goalDeadline})`);
  ok(goal && goal.status === 'active', 'goal is active');
  ok(fam && !objs.some((o) => o.pillar_id === fam.id), 'no goal for the skipped pillar');
  const side = (db.daily_actions || []).find((a) => a.name === 'Side project');
  const call = (db.daily_actions || []).find((a) => a.name === 'Call home');
  ok(side && goal && side.objective_id === goal.id, 'first pillar habit is linked to its goal (objective_id)');
  ok(side && side.type === 'session' && Number(side.target_minutes) === 90, 'first habit is timed, 90 min');
  ok(call && call.objective_id == null && call.type === 'session' && Number(call.target_minutes) === 15, 'second habit timed 15 min, no goal');
  const draft = await readDraft(); ok(draft === null, 'draft cleared after finishing'); }

await t.finish();
