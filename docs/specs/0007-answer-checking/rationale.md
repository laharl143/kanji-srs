# 0007. Answer checking rules: rationale

The decision record for [index.md](index.md): why the build spec looks the way it does.

## Context

Spec 0004 shipped exact answer checks on purpose: a meaning had to equal a listed meaning after trim and lowercase, and a reading had to equal a primary reading. That kept the core loop simple, but it marks you wrong for things that are not gaps in your knowledge. The content makes this worse than it sounds. 58 of 789 meanings carry brackets ("all day (long)", "to go out (e.g. on an excursion or outing)"), 100 start with "to ", and one has an accent ("ritsuryō"). For vocab, only the primary reading counts, so 日本 accepts にっぽん and rejects にほん; 31 of 208 vocab items have alternate readings like this.

Wrong answers in SRS are expensive: each one drops the item by stages (0001 §6.3), so a typo can cost you days of reviews. The opposite failure is just as real. Plain typo tolerance accepts a different word that happens to be close. Measured on the current bundle with the 0001 §7 thresholds, 581 meaning forms have another course meaning within the tolerance: "tree" passes for 三 (three, and tree is 木), "four" for 時 (hour), "man" for 本 (main), "nine" for 行 (line). Those are exactly the confusions the review exists to catch.

Kanji questions ask for the primary reading kind. In the current bundle every kanji reading is tagged `onyomi` or `kunyomi`, each kanji's primary readings are all one kind (all 75 are on'yomi today), no reading text appears under both kinds, and every reading is stored in hiragana. So "you typed the other kind" is well defined. The core loop also has a constraint the original Next.js spec did not: romaji turns into kana inside `AnswerInput` through `toReadingInput` (`wanakana.toKana` in IME mode), and `finishReadingInput` converts a trailing "n" on submit. The checker receives that finished text.

Your synonyms already have a home (`user_notes.synonyms`, spec 0002), but no screen edits them until feature 10. Ground rule 5 keeps `src/lib/answer` pure: no DB, no clock, no framework.

## Options considered

### Option 1: Thresholds only, as in 0001 §7

Normalize, compare, and accept anything within the Levenshtein tolerance.

**Pros**:
- Smallest code, exactly what 0001 wrote down.

**Cons**:
- Accepts other course words as typos (581 forms in the current bundle, including tree for three and four for hour), so real confusions stop costing anything.

### Option 2: Thresholds plus a course word guard (chosen)

Same thresholds, but an input that is exactly another subject's meaning is wrong. The set of course forms is built once per session from the content tables and passed into the pure checker.

**Pros**:
- Keeps typo tolerance for genuine slips and removes every measured false accept.
- Still pure: the checker takes the set as an argument.

**Cons**:
- One more load per session (789 meanings, trivial in size).
- Blocks a few harmless near misses that happen to be course words, such as "years" for 年 (year).

### Option 3: No typo tolerance

Normalize (brackets, "to", accents) but require an exact form match.

**Pros**:
- Never accepts a wrong word.

**Cons**:
- Every slip on a phone keyboard costs stages, which is the problem this feature exists to fix.

For the edit distance itself: a small in repo optimal string alignment distance (Levenshtein plus swaps of neighboring letters, about 20 lines) over a dependency such as `fastest-levenshtein`, which counts a swap as two edits; inputs are a few dozen characters, so speed does not matter and one fewer package does. For the shake: React Native's built in `Animated` (native driver, one `translateX` sequence) over Reanimated 4, which is installed but unused in `src`; a 300 ms nudge does not justify adopting a second animation system.

## Rationale

The cost of a false wrong answer and of a false right answer are both high in SRS, so neither plain thresholds (Option 1) nor no tolerance (Option 3) fits. The measured collisions are the deciding force: they are not rare edge cases but hundreds of pairs, many of them the very kanji you are most likely to mix up. Checking "is this exactly another item's answer" removes all of them while keeping tolerance for real slips, and it costs one read of data already on the phone.

Accepting every vocab reading (your choice) fixes 日本 and similar items; the archaic alternates it also accepts (ねんぢゅう) are harmless. Brackets and "to" being optional (your choice) matches how people actually type meanings. Wiring synonyms now (your choice) means feature 10 only has to add the editor.

Kanji keep primary readings only, with the other kind as a hint: that teaches which reading the kanji is usually read with, and the data guarantees the two kinds never overlap. Non counting results stay in the hook, not the queue, because the queue's contract (0004) is "an answer was judged right or wrong"; a shake is not a judgment.
