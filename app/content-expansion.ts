import type {Story} from './content';

export const expandedStories:Story[]=[
 {id:'forums',title:'Before the feed, there were rooms.',year:'1990s',category:'Origins',summary:'Forums gave early communities a shared memory and a place for context.',tags:['forums','threads','community'],sections:[
  {title:'A conversation with a shape',text:'Early web forums organized conversation into rooms, threads and replies. A post could be read long after it was written, so the discussion carried more memory than a fast-moving stream.'},
  {title:'Context was visible',text:'A question, answer and follow-up lived near one another. That structure made it easier to learn a community’s vocabulary, find an old explanation and see how an idea changed over time.'},
  {title:'The pattern continues',text:'Modern chat moves faster, but the need remains. A healthy community needs places for quick reactions and places where useful explanations can stay discoverable.'}
 ]},
 {id:'templates',title:'The template became the message.',year:'2010s',category:'Formats',summary:'Reusable formats let a community talk about a new moment with a familiar visual grammar.',tags:['templates','remix','participation'],sections:[
  {title:'Recognition does the setup',text:'When a format is familiar, a creator can spend less time explaining the premise and more time changing it. The audience supplies part of the joke from memory.'},
  {title:'Small changes carry meaning',text:'A crop, caption, reaction or deliberate misspelling can move a template from celebration to criticism. The structure stays recognizable while the author changes the point.'},
  {title:'Archive the variations',text:'A useful history records how a format was adapted, who used it and which context made the version work. The original image is only one part of the story.'}
 ]},
 {id:'short-form',title:'When the remix became the format.',year:'2020s',category:'Participation',summary:'Short-form video turned sounds, gestures and edits into portable creative prompts.',tags:['short video','audio','remix'],sections:[
  {title:'A sound can be a template',text:'A repeated sound gives people a shared starting point. The same audio can carry different stories when the image, timing or caption changes.'},
  {title:'The edit is part of the language',text:'Loops, cuts, stitches and transitions are not just decoration. They tell the audience how to read the moment and where the surprise is supposed to land.'},
  {title:'Speed changes context',text:'Fast circulation can make a format feel universal while hiding its origin. Credit, consent and a little research help keep participation from erasing the people who made the reference visible.'}
 ]},
 {id:'moderation',title:'A community needs memory and boundaries.',year:'Now',category:'Participation',summary:'Good conversation depends on discoverability, clear expectations and a way to repair harm.',tags:['moderation','trust','community'],sections:[
  {title:'Rules are part of the interface',text:'A channel description, pinned topic and visible report path tell people what kind of conversation belongs there. Good guidance makes participation easier before a conflict begins.'},
  {title:'Context helps review',text:'Moderation decisions are easier to understand when the original message, replies and reason are kept together. A report should create a review trail instead of becoming a hidden disappearance.'},
  {title:'Trust is maintained',text:'Healthy communities make room for correction. Clear expectations, reversible actions and an audit trail help members understand how a space is cared for.'}
 ]}
];

export const expandedCoinStories:Story[]=[
 {id:'identity',title:'Read the address, not the mascot.',year:'Field guide',category:'Research',summary:'An on-chain identifier is more useful than a familiar name or ticker.',tags:['addresses','verification','research'],sections:[
  {title:'Names are presentation',text:'A project name, logo or ticker helps people recognize a story, but it is not a unique on-chain identity. Similar names can appear on different networks and contracts.'},
  {title:'Identifiers provide context',text:'A network and address let you inspect the record that a project is referring to. Confirm that the identifier comes from an independently trusted source before using it.'},
  {title:'A record is not a promise',text:'An explorer can show what an address did. It cannot prove that an anonymous account is honest, that a project will continue or that an asset is suitable for you.'}
 ]},
 {id:'permissions',title:'A connection is not permission.',year:'Field guide',category:'Safety',summary:'Understand the difference between showing a public address and authorizing a wallet action.',tags:['wallets','permissions','safety'],sections:[
  {title:'Identify first',text:'A read-only connection may expose a public address so a website can display it. That address is not a private key and should not be treated as proof of ownership or trust.'},
  {title:'Inspect the request',text:'A signature or transaction request asks for an action. Read the network, destination, amount and permissions in the wallet interface. If the request does not match your intention, stop.'},
  {title:'Keep recovery material offline',text:'A website should never require a recovery phrase to show a public address. Treat unexpected urgency, secret requests and copied support accounts as warning signs.'}
 ]},
 {id:'liquidity',title:'Attention is not liquidity.',year:'2020s',category:'Research',summary:'A large conversation can make an asset visible without making it easy to exit.',tags:['markets','liquidity','risk'],sections:[
  {title:'Two different signals',text:'Attention measures how much people are discussing something. Liquidity describes whether trades can happen without moving the price dramatically. They are not interchangeable.'},
  {title:'Community language can hide uncertainty',text:'Words like community-owned, early and guaranteed can sound precise while leaving important questions unanswered. Look for verifiable records and clear disclosures.'},
  {title:'Learn before acting',text:'MemeSpace uses these examples to explain vocabulary and verification. It does not provide prices, trading signals, investment recommendations or transfer requests.'}
 ]}
];

export const expandedLearning=[
 {id:'research',title:'How to verify an on-chain claim',duration:'5 min',intro:'Build a small evidence trail before you trust a story about a wallet or token.',paragraphs:[
  'Start by naming the network. A transaction hash, token address or account has meaning only in the network where it exists.',
  'Check the identifier through more than one trusted path. A polished website can repeat a copied address, so compare the project’s official channels with an independent explorer.',
  'Separate what the record proves from what the project claims. A public transaction can show movement; it cannot certify an anonymous person, future returns or a safe contract.'
 ],question:'What should you confirm first?',answers:['The network and on-chain identifier','The project’s most exciting slogan','A screenshot from a group chat'],correct:0},
 {id:'security',title:'Scams, impersonation and pressure',duration:'5 min',intro:'Recognize the social patterns that try to rush a wallet decision.',paragraphs:[
  'Impersonation accounts borrow names, avatars and language from projects or support teams. The goal is often to make a private request feel official.',
  'Urgency is a tactic. A countdown, secret opportunity or request to bypass the normal interface should make you slow down and verify through an independent route.',
  'Never share a recovery phrase or private key with a website, moderator or support account. If a request is unexpected, close it and start again from a trusted bookmark.'
 ],question:'Which response is safest when a support account asks for a recovery phrase?',answers:['Share only the first words','Refuse and report the impersonation','Send it through a private message'],correct:1},
 {id:'communities',title:'How online communities keep context',duration:'4 min',intro:'Learn why channels, threads and moderation records make information easier to use.',paragraphs:[
  'Fast chat is useful for reactions, but it can bury an explanation quickly. Topics, replies and saved references give a community a memory that survives the moment.',
  'A clear channel description tells people what belongs there. A report path and a reasoned moderation record make boundaries visible instead of mysterious.',
  'The best community systems support both discovery and repair: people can find useful conversations, ask questions and understand how harm is handled.'
 ],question:'What helps a fast community conversation stay useful later?',answers:['Removing every old message','A topic, thread context and searchable history','Making every channel identical'],correct:1}
];
