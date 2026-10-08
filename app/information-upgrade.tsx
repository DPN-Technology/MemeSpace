"use client";

import {useEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, BookOpen, Check, CheckCircle2, Clock3, Compass, Copy, Search, Target} from 'lucide-react';
import {allStories, allCoinStories, allLearning, readingMinutes, readingText, type Reading, type Lesson, type Source} from './content-catalog';
import {LessonNotes} from './module-upgrades';
import {useLibrary} from './use-library';
import {useIdentityScope} from './identity-scope';

function SourceList({sources}: {sources?: Source[]}) {
  if (!sources?.length) return null;
  return <section className="reading-sources"><p className="micro-label">SOURCES & FURTHER READING</p>{sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight/></a>)}</section>;
}
function Bookmarks({story, saved, disabled, toggle}: {story: Reading; saved: boolean; disabled: boolean; toggle: () => void}) {
  return <button className={'reading-bookmark' + (saved ? ' saved' : '')} disabled={disabled} aria-label={(saved ? 'Unsave ' : 'Save ') + story.title} aria-pressed={saved} onClick={toggle}><Bookmark fill={saved ? 'currentColor' : 'none'}/>{saved ? 'Saved' : 'Save'}</button>;
}

export function EnhancedArchive({coins = false, target, openIdentity}: {coins?: boolean; target?: string; openIdentity?: () => void}) {
  const data = coins ? allCoinStories : allStories;
  const library = useLibrary();
  const scope = useIdentityScope();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedId, setSelectedId] = useState(target || '');
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState('order');
  const [copied, setCopied] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {setSelectedId(target || '');}, [target]);
  const selected = data.find(story => story.id === selectedId);
  const savedKeys = new Set(library.items.filter(item => item.kind === 'bookmark').map(item => item.item_key));
  const savedCount = data.filter(story => savedKeys.has(story.id)).length;
  const categories = ['All', ...new Set(data.map(story => story.category))];
  const results = data.filter(story => (category === 'All' || story.category === category) && (!savedOnly || savedKeys.has(story.id)) && readingText(story).toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === 'az' ? a.title.localeCompare(b.title) : sort === 'short' ? readingMinutes(a) - readingMinutes(b) : data.indexOf(a) - data.indexOf(b));

  function choose(id = '') {
    setSelectedId(id); setCopied('');
    history.replaceState(null, '', '#' + (coins ? 'coins' : 'history') + (id ? '/' + id : ''));
    document.querySelector('.workspace-body')?.scrollTo({top: 0});
    requestAnimationFrame(() => heading.current?.focus({preventScroll: true}));
  }
  async function toggle(story: Reading) {
    if (savedKeys.has(story.id)) await library.remove('bookmark', story.id);
    else await library.save('bookmark', story.id, {title: story.title, module: coins ? 'coins' : 'history'});
  }
  function filterCategory(value: string) {setCategory(value); choose();}
  const connections = selected ? data.filter(story => story.id !== selected.id).sort((a, b) => {
    const score = (story: Reading) => Number(story.category === selected.category) + story.tags.filter(tag => selected.tags.includes(tag)).length;
    return score(b) - score(a);
  }).slice(0, 3) : [];

  return <div className={'information-upgrade' + (coins ? ' coin-information' : '')}>
    <aside className="information-index">
      <div className="information-orbit" aria-hidden="true"><Compass/><span>{coins ? 'ON-CHAIN CONTEXT' : 'CULTURE, DECODED'}</span></div>
      <h2>{coins ? 'Understand the story. Inspect the record.' : 'The reference is only the beginning.'}</h2>
      <p>{coins ? 'Origins, networks and practical ways to read an on-chain claim.' : 'Follow the formats, people and shared context that make the internet make sense.'}</p>
      <div className="information-metrics"><div><strong>{data.length}</strong><span>{coins ? 'field guides' : 'stories'}</span></div><div><strong>{savedCount}</strong><span>in your list</span></div></div>
      <nav className="information-filters" aria-label="Reading categories">{categories.map(item => <button key={item} className={category === item && !savedOnly ? 'selected' : ''} aria-pressed={category === item && !savedOnly} onClick={() => {setSavedOnly(false); filterCategory(item);}}><span>{item === 'All' ? 'All reading' : item}</span><small>{item === 'All' ? data.length : data.filter(story => story.category === item).length}</small></button>)}<button className={savedOnly ? 'selected' : ''} aria-pressed={savedOnly} onClick={() => {setSavedOnly(value => !value); setCategory('All'); choose();}}><span><Bookmark/>Reading list</span><small>{savedCount}</small></button></nav>
      <div className="information-sidebar-note"><BookOpen/><p>{coins ? 'Learn the concepts here. Use the linked documentation to check the details.' : 'Read a story, try its example, then bring a better question to the conversation.'}</p>{scope === 'guest' && <button onClick={openIdentity}>Sign in to keep your reading list<ArrowUpRight/></button>}</div>
    </aside>
    <section className="information-main" aria-label={coins ? 'Memecoin reading' : 'Culture reading'}>
      {library.error && <p className="error" role="alert">{library.error} {scope === 'guest' && <button className="identity-inline-link" onClick={openIdentity}>Open Identity Center</button>}</p>}
      {selected ? <>
        <button className="back-inline" onClick={() => choose()}><ArrowLeft/>Back to the index</button>
        <article className="information-reader" key={selected.id}>
          <div className="reader-meta">{selected.year} <span>/</span> {selected.category} <span>/</span> {readingMinutes(selected)} MIN READ</div>
          <h2 ref={heading} tabIndex={-1}>{selected.title}</h2>
          <p className="reader-deck">{selected.summary}</p>
          <div className="information-actions"><Bookmarks story={selected} saved={savedKeys.has(selected.id)} disabled={library.busy || library.loading} toggle={() => void toggle(selected)}/><button className="reading-bookmark" onClick={async () => {try {await navigator.clipboard.writeText(location.href); setCopied('Story link copied.');} catch {setCopied('Copy the URL from your address bar.');}}}><Copy/>Copy link</button>{selected.tags.map(tag => <span className="chip" key={tag}>{tag}</span>)}</div>
          {copied && <p className="notice" role="status">{copied}</p>}
          <div className="reading-takeaway"><Target/><div><span className="micro-label">TAKE THIS WITH YOU</span><p>{selected.takeaway}</p></div></div>
          <nav className="reading-outline" aria-label="Article sections"><span className="micro-label">IN THIS STORY</span>{selected.sections.map((section, index) => <button key={section.title} onClick={() => document.getElementById('reading-' + selected.id + '-' + index)?.scrollIntoView({block: 'start'})}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}<ArrowRight/></button>)}</nav>
          <div className="reading-sections">{selected.sections.map((section, index) => <section id={'reading-' + selected.id + '-' + index} key={section.title}><span className="reading-section-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{section.title}</h3><p>{section.text}</p></div></section>)}</div>
          <section className="reading-example"><span className="micro-label">PUT IT IN CONTEXT · AN EXAMPLE</span><h3>Make the idea concrete.</h3><p>{selected.example}</p><div><Compass/><strong>{selected.question}</strong></div></section>
          <SourceList sources={selected.sources}/>
          <section className="related-reading"><p className="micro-label">KEEP EXPLORING</p>{connections.map(story => <button key={story.id} onClick={() => choose(story.id)}><span><small>{story.category} · {readingMinutes(story)} min</small><b>{story.title}</b></span><ArrowUpRight/></button>)}</section>
        </article>
      </> : <>
        <header className="information-hero"><div><p className="micro-label">{savedOnly ? 'YOUR READING LIST' : coins ? 'THE WEB3 FIELD GUIDE' : 'THE MEMESPACE READING ROOM'}</p><h2 ref={heading} tabIndex={-1}>{savedOnly ? 'Worth coming back to.' : coins ? 'Beyond the ticker.' : 'Know the story behind the share.'}</h2><p>{savedOnly ? 'The articles you have kept for another visit.' : coins ? 'Separate cultural history, technical facts and claims that need checking.' : 'Explore a living language of characters, formats and participation.'}</p></div><div className="information-hero-mark" aria-hidden="true">{coins ? '0x' : ':)'}<small>{coins ? 'VERIFY / UNDERSTAND' : 'ORIGIN / CONTEXT / REMIX'}</small></div></header>
        <div className="information-search-row"><label className="community-search"><Search/><input aria-label="Search reading" placeholder="Search stories, examples and ideas…" value={query} onChange={event => setQuery(event.target.value)}/></label><select aria-label="Sort reading" value={sort} onChange={event => setSort(event.target.value)}><option value="order">{coins ? 'Reading order' : 'Timeline'}</option><option value="az">Title A–Z</option><option value="short">Shortest first</option></select></div>
        <p className="reading-result-count">{results.length} {results.length === 1 ? 'article' : 'articles'}{category !== 'All' ? ' / ' + category : ''}{library.loading ? ' · Loading your reading list…' : ''}</p>
        <div className="reading-grid">{results.map(story => <article className="reading-card" key={story.id}><button className="reading-card-open" onClick={() => choose(story.id)}><div className="reading-card-top"><span>{story.category}</span><ArrowUpRight/></div><div className="reading-card-year">{story.year}<span>{String(data.indexOf(story) + 1).padStart(2, '0')}</span></div><h3>{story.title}</h3><p>{story.summary}</p></button><footer><span><Clock3/>{readingMinutes(story)} min read</span><Bookmarks story={story} saved={savedKeys.has(story.id)} disabled={library.busy || library.loading} toggle={() => void toggle(story)}/></footer></article>)}</div>
        {!results.length && <div className="information-empty"><Bookmark/><h3>{savedOnly ? 'Your next good read belongs here.' : 'No articles match yet.'}</h3><p>{savedOnly ? 'Use Save on any article to build your reading list.' : 'Try another word or clear the category filter.'}</p><button className="secondary-action" onClick={() => {setSavedOnly(false); setCategory('All'); setQuery('');}}>Browse all reading<ArrowRight/></button></div>}
      </>}
    </section>
  </div>;
}

function LessonContent({lesson, library, completed, openIdentity}: {lesson: Lesson; library: ReturnType<typeof useLibrary>; completed: boolean; openIdentity?: () => void}) {
  const [answer, setAnswer] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState('');
  async function checkAnswer() {
    setChecked(true);
    if (answer !== lesson.correct) {setStatus('Take another look, then try again.'); return;}
    if (completed) {setStatus('Correct. You have already completed this lesson.'); return;}
    const saved = await library.save('lesson', lesson.id, {title: lesson.title, score: 1});
    setStatus(saved ? 'Correct. Your completion is saved.' : 'Correct. Your completion has not been saved yet.');
  }
  return <>
    <div className="lesson-objective"><Target/><div><span className="micro-label">YOUR GOAL</span><p>{lesson.objective}</p></div></div>
    <div className="lesson-explanation">{lesson.paragraphs.map((paragraph, index) => <div key={paragraph}><span>{String(index + 1).padStart(2, '0')}</span><p>{paragraph}</p></div>)}</div>
    <section className="lesson-practice"><span className="micro-label">TRY IT WITHOUT A WALLET</span><h3>Apply the idea.</h3><p>{lesson.exercise}</p></section>
    <section className="lesson-quiz"><p className="micro-label">KNOWLEDGE CHECK</p><fieldset disabled={library.busy}><legend>{lesson.question}</legend>{lesson.answers.map((option, index) => <label className={(answer === index ? 'selected ' : '') + (checked && answer === index ? index === lesson.correct ? 'correct' : 'incorrect' : '')} key={option}><input type="radio" name={'answer-' + lesson.id} checked={answer === index} onChange={() => {setAnswer(index); setChecked(false); setStatus('');}}/><span>{option}</span>{checked && answer === index && index === lesson.correct && <Check/>}</label>)}</fieldset><button className="primary-action" disabled={answer === null || library.busy || library.loading} onClick={() => void checkAnswer()}>{library.busy ? 'Saving…' : 'Check answer'}<ArrowRight/></button>{checked && <div className="lesson-feedback" role="status"><strong>{status}</strong><p>{lesson.explanation}</p></div>}</section>
    <LessonNotes id={lesson.id} title={lesson.title} entry={library.items.find(item => item.kind === 'note' && item.item_key === lesson.id)} save={library.save} openIdentity={openIdentity}/>
    <SourceList sources={lesson.sources}/>
  </>;
}

export function EnhancedAcademy({target, openIdentity}: {target?: string; openIdentity?: () => void}) {
  const library = useLibrary();
  const [selectedId, setSelectedId] = useState(target || allLearning[0].id);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {if (target) setSelectedId(target);}, [target]);
  const completed = new Set(library.items.filter(item => item.kind === 'lesson' && allLearning.some(lesson => lesson.id === item.item_key)).map(item => item.item_key));
  const lesson = allLearning.find(item => item.id === selectedId) || allLearning[0];
  const index = allLearning.indexOf(lesson);
  const nextLesson = allLearning.find(item => !completed.has(item.id));
  function choose(id: string) {
    setSelectedId(id); history.replaceState(null, '', '#learn/' + id);
    document.querySelector('.workspace-body')?.scrollTo({top: 0});
    requestAnimationFrame(() => heading.current?.focus({preventScroll: true}));
  }
  return <div className="academy-upgrade">
    <aside className="academy-path"><p className="micro-label">THE LEARNING PATH</p><h2>Build understanding.<br/>Keep your progress.</h2><p>Short lessons, practical exercises and a place for your own notes.</p>
      <div className="academy-progress"><div><strong>{completed.size}<span> / {allLearning.length}</span></strong><span>lessons complete</span></div><progress aria-label="Course completion" value={completed.size} max={allLearning.length}/>{nextLesson && <button disabled={library.loading} onClick={() => choose(nextLesson.id)}>Continue learning<ArrowRight/></button>}{completed.size === allLearning.length && <span className="academy-complete"><CheckCircle2/>Path complete. Revisit any lesson.</span>}</div>
      <nav aria-label="Lesson path">{['Foundations', 'Safer actions', 'Culture'].map(track => <div className="academy-track" key={track}><h3>{track}</h3>{allLearning.filter(item => item.track === track).map(item => <button key={item.id} onClick={() => choose(item.id)} aria-current={lesson.id === item.id ? 'step' : undefined} className={lesson.id === item.id ? 'selected' : ''}><span className={'lesson-step' + (completed.has(item.id) ? ' completed' : '')}>{completed.has(item.id) ? <Check/> : String(allLearning.indexOf(item) + 1).padStart(2, '0')}</span><span><b>{item.title}</b><small>{item.duration}{completed.has(item.id) ? ' · Complete' : ''}</small></span></button>)}</div>)}</nav>
      <p className="academy-disclaimer">Education, not investment recommendations. No wallet connection or purchase is needed.</p>
    </aside>
    <section className="academy-main" aria-label="Current lesson"><header className="academy-lesson-header"><p className="micro-label">{lesson.track.toUpperCase()} / LESSON {String(index + 1).padStart(2, '0')}</p><h2 ref={heading} tabIndex={-1}>{lesson.title}</h2><p>{lesson.intro}</p><div><span><Clock3/>{lesson.duration} + your notes</span>{completed.has(lesson.id) && <span className="lesson-complete-badge"><CheckCircle2/>Completed</span>}</div></header>
      {library.error && <p className="error" role="alert">{library.error} <button className="identity-inline-link" onClick={openIdentity}>Open Identity Center</button></p>}
      <LessonContent key={lesson.id} lesson={lesson} library={library} completed={completed.has(lesson.id)} openIdentity={openIdentity}/>
      <nav className="lesson-pagination" aria-label="Lesson navigation"><button className="secondary-action" disabled={index === 0} onClick={() => choose(allLearning[index - 1].id)}><ArrowLeft/>Previous lesson</button><button className="secondary-action" disabled={index === allLearning.length - 1} onClick={() => choose(allLearning[index + 1].id)}>Next lesson<ArrowRight/></button></nav>
    </section>
  </div>;
}
