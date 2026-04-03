To Do: build a ai teleprompter webapp

- easy to read, scrolls automaticaly
- goal is to move the speech as you are reading it

challenges:
1* latency
2* offscripting (go off script - not to follow it)

Latency:
_ the issue of the text being in the right place at the right time, so eyes dont move too much
_ Jade: in visual perception (took a class on this!), eye movement is either continuous tracking (continuous motion, ie bird flying) or saccades (snap movements, one object of focus to another)
_ Jade: In the case of yarn, the desired outcome is no eye movement + eye pointed near camera (simulate eye contact)
_ Jade: Though we are used to animation being a standard for smooth visual UX, animating text here will cause continuous eye movement / tracking. + cognitive overhead for reader
\_ Jade: SOLUTION 1: the way I've seen people solve this is have words show up on the screen in one spot only, in fact, centering a specific letter as the anchor, and swapping out the words (more on line 27)

Going off-script:
_ users may not PERFECTLY read back script. they might add words, remove words.
_ how do we factor that into speed of 'scrolling'? an offset.
_ Jade: in DJing, where multi-tracks are synced up, there is a foundational skill called 'beat matching', and is a combination of changing tempo (BPM), and shifting the 'phase' to align the beat, either incrementally using the jogwheel, or by jumping forwards/backwards by multiples of 1, 2, 4, 8 single notes.
_ Jade: the analogical equivalent for this in teleprompter is 2 things: (1) bpm is equivalent to a transient change in words per minute (it is likely offscripting involves a slight pause or adjustment in pace), and (2)offscripting will add 1, 2, .. n words to the scheduled playback, delaying it by n.

For reasons mentioend above in Latency, I would challenge the suggested implementation for displaying text in prose.
Also, while larger is more readable, enlarging the prose-style display results in more noticeable eye movement.
-> This may be fixable via post-processed 'fixed eyes' (I've seen this sort of thing / I know it exists) but best practice to fix issue at the source.

Now that I've written out my thinking in natural language / translated the brief, I am going to re-write it but for a LLM to translate it into a product description it can organize and i can skim through, to then further advance it in a coding agent flow.

A) I will research Solution A (words showing up in one spot) Result: 'Rapid Serial Visual Presentation', or RSVP. the idea that most reading time is spent on 'eye movement' (saccades).
example products: SwiftRead, Spreeder, BeeLine Reader (!! interesting UX: they apply gradient to text, which guides the eye across prose easier. might use this idea later.)
B) I will research how I might get AI speech processing to output the following:
B1) words per minute pace (as a running average, OR something that the user calibrates at the start, by simulating their regular demo speech)
B1 bonus) IDEA: from B: prior to 'read back script', user goes through a step of 'calibrating' their reading speed. they will read a paragraph, the AI will tell them their WPM (words per minute), IF their WPM falls within a reasonable range, they move on. else the app will explain to them why slower or faster is better statistically.
B2) what word was spoken. this is important because even with a significant latency between actual speech and AI stream back (ie 300ms), it's still possible for the software to extrapolate based on the speed. Standard thing to do with kinematics / predictive tracking. The important thing here is for the client side script to take notice as to WHEN the user goes off script, to begin displaying the 'speech to text' changes and insert them into a updated version of the original 'input text', and then give the user a way to return to the scripted words.
B3) There is a case where a user will go off script, the software will notice succesfully, pausing the words in the RSVP, but upon returning to the script, the user only has one word to look at. For that reason, I would like this software to, upon noticing that a user is going off script, begin adding more words to the RSVP, so that upon returning, the user has a runway of 500ms of readable words before his reading syncs back up (and before the speech AI can recognize that they are back on track etc)
C1) links to B1: the words per minute is not just done at the start, but can be constantly updated, as to let the user know if they are exceeding the speed. tihs can be done as a 'ambient interface', a UI element that is not distracting, but is obvious within the periphery. An obvious example is like a meter showing green to yellow to red, like a loudness meter, let's maybe implement that but horizontally, right above the word (at the edge of the window), and a thin height (maybe 10px), and with a dynamic variable with in addition to the color change, to make it accessible for anyone not able to perceive color changes. 'Blue' for speed up (like an engine running cold), red for 'slow down' (like getting too hot), and green for 'good speed'. These work out well because yellow and green and blue are adjacent on the color wheel, no weird saturation issues in between.

Above: 2:16pm to 2:58 pm (minute 0 to minute 42)

With claude's help, found three good contenders for speech tracking for my use case:
Deepgram, AssemblyAI, Web Speech API
The pros and cons work in favor of Deepgram:

- 200ms latency (vs ~300-400 for assemblyAI, 150ms for webpspeechAPI)
- word level timetsamps out of the box (helps word per minute solution to extrapolating current word), webpseechAPI does not have that
- excellent docs, claude can read them. freetier with 12,000min/yr

above: 2:58pm to 3:15pm (minute 42 to 70). Includes a chat with claude on browser to come up with a good markdown to feed claude code
3:15-3:25, reading markdown and reviewing all is ready for agentic code generation
3:25pm (minute 68+) : generating
