// Initial content. Used only the first time the app runs, when data/db.json is missing.
"use strict";

const SEED = [
  { code: "JS", title: "JavaScript & ES6+", questions: [
    "What's the difference between var, let, and const in terms of scope and hoisting?",
    "Explain closures and describe a real scenario where they're useful.",
    "What is the event loop, and how do microtasks differ from macrotasks?",
    "What's the difference between == and ===?",
    "Explain prototypal inheritance in JavaScript.",
    "What's the difference between call, apply, and bind?",
    "How does 'this' behave differently in arrow functions versus regular functions?",
    "What are Promises, and how do async/await relate to them under the hood?",
    "What's the difference between a shallow copy and a deep copy of an object?",
    "Explain debouncing and throttling, and when you'd use each.",
    "What's the difference between null and undefined?",
    "At a high level, how does JavaScript's garbage collection work?"
  ]},
  { code: "TS", title: "TypeScript", questions: [
    "What's the difference between interface and type?",
    "What are generics, and why are they useful?",
    "What's the difference between unknown and any?",
    "What is type narrowing, and how do type guards help with it?",
    "What are union types and intersection types?",
    "What does the readonly modifier do, and when would you use it?",
    "What are utility types like Partial, Pick, and Omit used for?",
    "How does TypeScript's structural typing differ from nominal typing?",
    "What's the difference between an enum and a union of string literals?",
    "What is declaration merging?"
  ]},
  { code: "RE", title: "React", questions: [
    "What's the difference between state and props?",
    "Explain the React reconciliation process and how the virtual DOM fits in.",
    "What are keys in lists for, and why do they matter for rendering?",
    "What's the difference between controlled and uncontrolled components?",
    "Explain useEffect's dependency array and common pitfalls with it.",
    "What's the difference between useMemo and useCallback?",
    "What is React Context, and when would you reach for it instead of a state library?",
    "What causes unnecessary re-renders, and how can you prevent them?",
    "What's the difference between a custom hook and a regular utility function?",
    "How does React batch state updates?",
    "What are error boundaries, and what kinds of errors can't they catch?",
    "What's the difference between server components and client components?"
  ]},
  { code: "NX", title: "Next.js", questions: [
    "What's the difference between server-side rendering, static generation, and client-side rendering?",
    "How does the App Router differ from the Pages Router?",
    "What are Server Components, and how do they differ from Client Components?",
    "How does data fetching and caching work in Next.js by default?",
    "What is Incremental Static Regeneration, and when would you use it?",
    "How does Next.js handle routing and dynamic route segments?",
    "What are route handlers (API routes) used for?",
    "How does Next.js optimize images and fonts out of the box?",
    "What's the difference between next/link navigation and a plain anchor tag?",
    "How would you handle environment variables and secrets in a Next.js app?"
  ]},
  { code: "CS", title: "CSS & Layout", questions: [
    "What's the difference between Flexbox and CSS Grid, and when would you pick one over the other?",
    "Explain the CSS box model.",
    "What's the difference between em, rem, %, and vh/vw units?",
    "How is CSS specificity calculated?",
    "What's the difference between position: absolute, relative, fixed, and sticky?",
    "What is the cascade, and how do source order and specificity interact?",
    "How would you approach responsive design without a utility framework like Tailwind?",
    "What causes layout shift, and how can you prevent it?",
    "What's the difference between CSS Modules, Sass, and utility-first CSS?",
    "How do CSS custom properties work, and how do they differ from Sass variables?"
  ]},
  { code: "ST", title: "State Management", questions: [
    "When would you reach for a state library like Zustand instead of React Context?",
    "What's the difference between local component state, global state, and server state?",
    "What problem does Zustand solve differently from Redux?",
    "What is prop drilling, and what are common ways to avoid it?",
    "How do you decide what belongs in global state versus what stays local?",
    "What are the trade-offs of storing UI state and server-fetched data in the same store?"
  ]},
  { code: "TE", title: "Testing", questions: [
    "What's the difference between unit tests, integration tests, and end-to-end tests?",
    "What's the philosophy behind React Testing Library's 'test behavior, not implementation'?",
    "What's the difference between a mock, a stub, and a spy?",
    "What makes a test flaky, and how would you address it?",
    "How would you test a component that depends on an API call?",
    "What is snapshot testing, and what are its downsides?",
    "What's the difference between getBy, queryBy, and findBy in React Testing Library?",
    "How do you decide what's worth testing versus what isn't?"
  ]},
  { code: "AP", title: "REST, HTTP & APIs", questions: [
    "What's the difference between REST and other API styles like GraphQL?",
    "What do GET, POST, PUT, PATCH, and DELETE mean, and when is each appropriate?",
    "What's the difference between 4xx and 5xx status codes? Name a few specific ones.",
    "What is idempotency, and which HTTP methods are supposed to be idempotent?",
    "What is CORS, and why does it exist?",
    "What's the difference between authentication and authorization?",
    "What is an OpenAPI spec used for, and how does client-code generation from it work?",
    "What's the difference between cookies, local storage, and session storage for auth tokens?",
    "What are the trade-offs of a JWT in local storage versus an HTTP-only cookie?"
  ]},
  { code: "RT", title: "Real-Time & SSE", questions: [
    "What's the difference between polling, long-polling, WebSockets, and Server-Sent Events?",
    "When would you choose SSE over WebSockets, and vice versa?",
    "What are the limitations of SSE, for example connection limits or direction of data flow?",
    "How does a browser handle a dropped SSE or WebSocket connection, and how would you handle reconnection?",
    "How does structuring a frontend around a live data stream differ from structuring it around request/response?",
    "How would you keep a UI consistent if live updates arrive out of order or are duplicated?"
  ]},
  { code: "PF", title: "Performance & Browser", questions: [
    "What are the steps in the critical rendering path: parsing, layout, paint, composite?",
    "What are Core Web Vitals (LCP, CLS, INP), and what does each measure?",
    "What's the difference between code splitting and lazy loading?",
    "How does browser caching work, for example cache-control headers and ETags?",
    "What causes a memory leak in a frontend app, and how would you go about finding one?",
    "What's the difference between debounce/throttle and requestAnimationFrame for performance-sensitive updates?",
    "What triggers a repaint versus a reflow, and why does that distinction matter for performance?"
  ]},
  { code: "GT", title: "Git & Collaboration", questions: [
    "What's the difference between git merge and git rebase?",
    "What is a merge conflict, and how do you resolve one?",
    "What's the difference between git fetch and git pull?",
    "What's a reasonable branching strategy for a small team, and why?",
    "What does git cherry-pick do, and when would you use it?",
    "What's the difference between git reset and git revert?"
  ]},
  { code: "SQ", title: "SQL & PostgreSQL", questions: [
    "What's the difference between INNER JOIN, LEFT JOIN, and RIGHT JOIN?",
    "What's the difference between a primary key and a foreign key?",
    "What's the difference between WHERE and HAVING?",
    "What is database indexing, and how does it affect query performance?",
    "What's the difference between normalization and denormalization?",
    "What is a database transaction, and what do the ACID properties mean?"
  ]}
];

function buildSeedDb(makeId) {
  const now = new Date().toISOString();
  const categories = [];
  const questions = [];

  SEED.forEach(function (cat, ci) {
    const categoryId = makeId("c");
    categories.push({
      id: categoryId,
      code: cat.code,
      title: cat.title,
      order: ci,
      createdAt: now
    });
    cat.questions.forEach(function (text, qi) {
      questions.push({
        id: makeId("q"),
        categoryId: categoryId,
        text: text,
        answer: "",
        status: "todo",
        starred: false,
        order: qi,
        createdAt: now,
        updatedAt: now,
        reviewedAt: null
      });
    });
  });

  return { version: 1, createdAt: now, categories: categories, questions: questions };
}

module.exports = { buildSeedDb: buildSeedDb };
