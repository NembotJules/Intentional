/**
 * US-096 · Unlock with intention, on the web (a preview: web and Expo Go have no Screen Time, so nothing is
 * unlocked; the block screen, its button and the timed re-block are device checks).
 *  (a) Blocking rules → "Unlocking early" → Try the unlock screen.
 *  (b) "Is this intentional?", the preview notice, 5 / 10 / 15 min; "Keep it blocked" is the big button.
 *  (c) The unlock button stays off until the sentence is typed word for word: empty, a wrong word, the wrong
 *      minutes all keep it off; changing the minutes changes the sentence and clears what was typed.
 *  (d) Typed right (any case, no full stop) → "That's it." → Unlock for 10 min → "Unlocked, on purpose".
 *  (e) Keep it blocked leaves the screen.
 */
import { start } from './lib.mjs';

const t = await start('unlock');
const { page, ok, has, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const disabled = async (l) => (await label(l).last().getAttribute('aria-disabled')) === 'true';

const db = {
  meta_goals: [{ id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 }],
  daily_actions: [],
  objectives: [],
  tasks: [],
  focus_sessions: [],
  habit_completions: [],
  habit_skips: [],
  milestones: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1', flick_stage_seen: '0', milestones_backfilled: '1' };

await t.goto('/');
await t.wait(2000);
await t.seed(db, settings);

// ── (a) the entry in Blocking rules ──
await t.goto('/blocking');
await t.waitText('Unlocking early', 30000);
ok(await has('When you open a blocked app, Intentional asks: is this intentional?'), 'Blocking rules explains unlocking early');
ok(await has('A focus session can’t be unlocked this way'), 'it says a focus session can\'t be unlocked with a sentence');
ok(await has('A preview: nothing is unlocked in this version'), 'on the web the row says it is a preview');
await label('Try the unlock screen').last().click();
await t.waitText('Type this to unlock', 20000);

// ── (b) the screen ──
ok((await has('Is this intentional?')) && (await has('Preview: on our iPhone build, a blocked app sends you here.')), '"Is this intentional?" and the preview notice');
ok(await has('Your apps are blocked so your hours go where you chose.'), 'why the apps are blocked');
for (const m of [5, 10, 15]) ok((await label(`Unlock for ${m} minutes`).count()) === 1, `a ${m} min choice`);
ok((await label('Sentence: I choose my phone over Body for 5 minutes.').count()) === 1, 'the sentence names the pillar (Body) and 5 minutes by default');
ok((await label('Keep it blocked').count()) === 1, '"Keep it blocked" is there');
await shot('start');

// ── (c) the unlock button waits for the exact sentence ──
ok(await disabled('Unlock for 5 min'), 'empty: Unlock is off');
await label('Type the sentence').fill('I choose my phone over Craft');
await t.wait(300);
ok(await disabled('Unlock for 5 min') && (await has('Not quite: check the words.')), 'a wrong word: Unlock stays off, "Not quite"');
await label('Type the sentence').fill('I choose my phone over Body for 5 minutes.');
await label('Unlock for 10 minutes').click();
await t.wait(300);
ok((await label('Sentence: I choose my phone over Body for 10 minutes.').count()) === 1, 'choosing 10 min changes the sentence');
ok((await label('Type the sentence').inputValue()) === '' && (await disabled('Unlock for 10 min')), 'and clears what was typed: Unlock is off again');
await label('Type the sentence').fill('I choose my phone over Body for 5 minutes.');
await t.wait(300);
ok(await disabled('Unlock for 10 min'), 'the old minutes don\'t unlock');
await shot('wrong');

// ── (d) typed right ──
await label('Type the sentence').fill('i choose my phone over body for 10 minutes');
await t.wait(300);
ok(!(await disabled('Unlock for 10 min')) && (await has('That’s it.')), 'typed right (any case, no full stop): "That\'s it." and Unlock is on');
await shot('typed');
await label('Unlock for 10 min').last().click();
await t.waitText('Unlocked, on purpose', 10000);
ok(await has('your apps would open now for 10 minutes, then block again on their own'), 'preview: the apps would open for 10 minutes, then block again');
await shot('unlocked');

// ── (e) Keep it blocked leaves ──
await t.goto('/blocking');
await t.waitText('Unlocking early', 20000);
await label('Try the unlock screen').last().click();
await t.waitText('Type this to unlock', 20000);
await label('Keep it blocked').last().click();
await t.waitText('Unlocking early', 20000);
ok(!(await has('Type this to unlock')) && (await has('Unlocking early')), '"Keep it blocked" goes back');

await t.finish();
