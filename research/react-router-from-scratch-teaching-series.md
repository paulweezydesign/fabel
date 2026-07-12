# Building a React Router From Scratch (Not a Wrapper)

**Research date:** 2026-07-12  
**Audience:** Developers who want to *understand* routing deeply and teach it across Medium, LinkedIn, and a personal blog  
**Scope:** Client router from first principles → nested routes → params → loaders → actions → React Server Components (RSC)

---

## Executive Summary

React has no built-in router. Libraries like React Router, TanStack Router, and Next.js App Router solve the same underlying problems:

1. **Map URLs to UI** (route matching)
2. **Change URLs without full page reloads** (History API)
3. **Share navigation state** (context / stores)
4. **Load data in sync with navigation** (loaders)
5. **Mutate data and refresh views** (actions + revalidation)
6. **On the server:** match the same routes and render HTML or RSC payloads

This research outlines how to build all six layers yourself — without wrapping `react-router` — and structures the material as a **6-part teaching series** suitable for Medium, LinkedIn carousels, and long-form blog posts.

**Key architectural decision:** Keep route matching **outside React** in a plain module (`routes.ts`) so the same matcher runs on server and client. This is essential for RSC and SSR.

---

## Multi-Post Series Outline (Publishing Plan)

| Part | Title (working) | Hook for LinkedIn | Medium/Blog focus |
|------|-----------------|-------------------|-------------------|
| 1 | *Your First React Router in 100 Lines* | "React has no router. Here's how to build one." | History API, `popstate`, Context, `<Link>` |
| 2 | *Route Params Without Magic* | "How `:id` actually works under the hood" | `path-to-regexp`, `useParams`, splats |
| 3 | *Nested Routes & the Outlet Pattern* | "Why dashboards don't remount on every click" | Route trees, layout routes, index routes |
| 4 | *Loaders: Fetch Before You Paint* | "Stop fetching in useEffect after navigation" | Loader pipeline, Suspense, `use()` |
| 5 | *Actions & Revalidation* | "Forms that refresh data automatically" | POST actions, optimistic UI, fetchers |
| 6 | *Same Router, Server Components* | "One route table, two runtimes" | RSC payload, dual entry, `createCallServer` |

Each post should end with: **What we built**, **What production routers add**, **Exercise for the reader**.

---

## Mental Model: Three Layers

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: UI — <Router>, <Link>, <Outlet>, hooks        │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Data — loaders, actions, revalidation         │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Core — history, location, matchRoute()        │
└─────────────────────────────────────────────────────────┘
         ▲                           ▲
         │                           │
    Browser (client)            Node (server / RSC)
```

Production routers (React Router v7, TanStack Router) add: code splitting, error boundaries, middleware, typed routes, and bundler integration. Your scratch router teaches the **core invariants** those features build on.

---

## Part 1: History, Location, and Router Context

### What the browser gives you

- `window.history.pushState(state, '', url)` — navigate forward, **does not** fire `popstate`
- `window.history.replaceState(...)` — replace current entry
- `window.history.back()` / `forward()` / `go(n)` — fires `popstate`
- `popstate` event — back/forward only; you must read `window.location` inside the handler

### Minimal `Location` type

```typescript
export type Location = {
  pathname: string;
  search: string;
  hash: string;
  state: unknown;
};

export const readLocation = (): Location => ({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: window.location.hash,
  state: window.history.state,
});
```

### History manager (the heart of client routing)

```typescript
export type History = {
  location: Location;
  push: (to: string, state?: unknown) => void;
  replace: (to: string, state?: unknown) => void;
  listen: (fn: (loc: Location) => void) => () => void;
};

export const createBrowserHistory = (): History => {
  let location = readLocation();
  const listeners = new Set<(loc: Location) => void>();

  const notify = () => listeners.forEach((fn) => fn(location));

  const navigate = (to: string, state: unknown, method: 'push' | 'replace') => {
    const url = new URL(to, window.location.origin);
    location = {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      state,
    };
    method === 'push'
      ? window.history.pushState(state, '', url.pathname + url.search + url.hash)
      : window.history.replaceState(state, '', url.pathname + url.search + url.hash);
    notify();
  };

  window.addEventListener('popstate', () => {
    location = readLocation();
    notify();
  });

  return {
    get location() {
      return location;
    },
    push: (to, state) => navigate(to, state, 'push'),
    replace: (to, state) => navigate(to, state, 'replace'),
    listen: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
};
```

### Router provider

```tsx
const RouterContext = createContext<{ history: History; location: Location } | null>(null);

export function Router({ history, children }: { history: History; children: React.ReactNode }) {
  const [location, setLocation] = useState(history.location);

  useEffect(() => history.listen(setLocation), [history]);

  return (
    <RouterContext.Provider value={{ history, location }}>
      {children}
    </RouterContext.Provider>
  );
}

export const useRouter = () => {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter requires <Router>');
  return ctx;
};
```

### Link (intercept clicks, preserve SPA behavior)

```tsx
export function Link({ to, replace, children, ...rest }: LinkProps) {
  const { history } = useRouter();
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        replace ? history.replace(to) : history.push(to);
      }}
    >
      {children}
    </a>
  );
}
```

**Teaching moment:** This is exactly what React Router's `<Link>` does — real `href` for accessibility/SEO, `preventDefault` for in-app navigation.

---

## Part 2: Route Matching and Params

Don't hand-roll regex for production paths. Use **`path-to-regexp`** (same family React Router uses) or implement a minimal `:param` parser for teaching.

### Route config (framework-agnostic — import on server + client)

```typescript
import { match } from 'path-to-regexp';

export type RouteNode = {
  id: string;
  path?: string;           // omit for layout-only (adds nesting, no URL segment)
  index?: boolean;
  Component?: React.ComponentType<RouteComponentProps>;
  children?: RouteNode[];
  loader?: LoaderFn;
  action?: ActionFn;
};

export type RouteComponentProps = {
  params: Record<string, string>;
  loaderData?: unknown;
};

type Match = {
  route: RouteNode;
  params: Record<string, string>;
  pathname: string; // matched portion
};

export function matchRoutes(routes: RouteNode[], pathname: string, base = ''): Match[] | null {
  for (const route of routes) {
    const fullPath = joinPaths(base, route.path ?? '');

    if (route.index) {
      if (pathname === base || pathname === base + '/') {
        return [{ route, params: {}, pathname: base }];
      }
      continue;
    }

    if (!route.path) {
      // layout route — recurse without consuming URL
      const child = route.children && matchRoutes(route.children, pathname, base);
      if (child) return [{ route, params: {}, pathname: base }, ...child];
      continue;
    }

    const matcher = match(fullPath, { end: false });
    const result = matcher(pathname);
    if (!result) continue;

    const params = result.params as Record<string, string>;
    const consumed = result.path;

    if (route.children?.length) {
      const child = matchRoutes(route.children, pathname, consumed);
      if (child) return [{ route, params, pathname: consumed }, ...child];
    }

    // leaf: require full path consumed for end match
    const endMatcher = match(fullPath, { end: true });
    if (endMatcher(pathname)) {
      return [{ route, params, pathname: consumed }];
    }
  }
  return null;
}

const joinPaths = (a: string, b: string) =>
  `${a}/${b}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
```

### `useParams` hook

```typescript
const ParamsContext = createContext<Record<string, string>>({});

export const useParams = <T extends Record<string, string> = Record<string, string>>() =>
  useContext(ParamsContext) as T;
```

Merge params from all matches in the branch (parent `:teamId` + child `:taskId`).

### Supported param patterns (teach progressively)

| Pattern | Example | Params |
|---------|---------|--------|
| Static | `/about` | `{}` |
| Dynamic | `/users/:userId` | `{ userId }` |
| Optional | `/posts/:year?/:slug?` | partial |
| Splat | `/files/*` | `{ '*': 'a/b/c' }` |

---

## Part 3: Nested Routes and `<Outlet>`

Nested routing = **multiple matches** rendered as a tree, not a flat switch.

### Example route tree

```typescript
export const routes: RouteNode[] = [
  {
    id: 'root',
    path: '/',
    Component: RootLayout,
    children: [
      { id: 'home', index: true, Component: HomePage },
      {
        id: 'dashboard',
        path: 'dashboard',
        Component: DashboardLayout,
        children: [
          { id: 'dash-home', index: true, Component: DashboardHome },
          { id: 'settings', path: 'settings', Component: SettingsPage },
          { id: 'project', path: 'projects/:projectId', Component: ProjectPage },
        ],
      },
    ],
  },
];
```

### `<Outlet>` — render the next match in the branch

```tsx
const OutletContext = createContext<number>(0);

export function Outlet() {
  const depth = useContext(OutletContext);
  const matches = useMatches(); // from router state
  const match = matches[depth + 1];
  if (!match?.route.Component) return null;
  const Component = match.route.Component;
  return (
    <ParamsContext.Provider value={{ ...parentParams, ...match.params }}>
      <OutletContext.Provider value={depth + 1}>
        <Component params={match.params} loaderData={match.loaderData} />
      </OutletContext.Provider>
    </ParamsContext.Provider>
  );
}
```

### Index routes

An **index route** renders at the **parent's URL** when no child segment matches — e.g. `/dashboard` shows `DashboardHome` inside `DashboardLayout`.

### Layout routes (pathless parents)

A route with `children` but no `path` wraps descendants without adding a URL segment — same as React Router "layout routes."

**Teaching moment:** Nested routes keep shared chrome (sidebar, header) mounted while leaf content swaps — that's the "native app feel."

---

## Part 4: Loading Data (Loaders)

### The problem with `useEffect` fetching

```tsx
// ❌ Anti-pattern for route-bound data
function ProjectPage() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`/api/projects/${projectId}`).then(r => r.json()).then(setData);
  }, [projectId]);
  if (!data) return <Spinner />;
  return <ProjectView data={data} />;
}
```

Problems: waterfall, no integration with navigation transitions, hard to SSR, race conditions on fast navigation.

### Loader contract

```typescript
export type LoaderContext = {
  request: Request;           // method, url, headers, body
  params: Record<string, string>;
  location: Location;
};

export type LoaderFn = (ctx: LoaderContext) => Promise<unknown> | unknown;
```

Run loaders for **every matched route** in the branch (parent + child) — deepest data often depends on parent layout data.

### Navigation pipeline

```typescript
async function navigateWithData(
  history: History,
  nextPath: string,
  routes: RouteNode[],
) {
  const matches = matchRoutes(routes, nextPath);
  if (!matches) throw notFound();

  const loaderResults = await Promise.all(
    matches.map(async (m) => {
      if (!m.route.loader) return { id: m.route.id, data: undefined };
      const data = await m.route.loader({
        request: new Request(window.location.origin + nextPath),
        params: m.params,
        location: { ...history.location, pathname: nextPath },
      });
      return { id: m.route.id, data };
    }),
  );

  history.push(nextPath);
  setRouterState({ matches, loaderData: Object.fromEntries(loaderResults.map(r => [r.id, r.data])) });
}
```

### `useLoaderData`

```typescript
export function useLoaderData<T>(routeId: string): T {
  const data = useRouterState(s => s.loaderData[routeId]);
  if (data === undefined) throw new Error(`No loader data for ${routeId}`);
  return data as T;
}
```

### Suspense + React 19 `use()` (Render-as-you-fetch)

Start the promise **before** rendering the child, pass it as a prop:

```tsx
// loader returns a Promise — don't await in loader for streaming
export async function projectLoader({ params }: LoaderContext) {
  return fetch(`/api/projects/${params.projectId}`).then(r => r.json());
}

function ProjectPage({ loaderData }: { loaderData: Promise<Project> }) {
  const project = use(loaderData);
  return <ProjectView project={project} />;
}
```

Wrap with `<Suspense fallback={<Skeleton />}>` at the layout boundary.

### Stale-while-revalidate pattern

Keep previous `loaderData` visible during navigation; swap when new loaders resolve. Show a subtle pending indicator on the `<Outlet>`.

---

## Part 5: Mutating Data (Actions)

Inspired by React Router actions + Remix form model.

### Action contract

```typescript
export type ActionFn = (ctx: LoaderContext) => Promise<unknown> | unknown | Response;
```

### Form-driven mutations

```tsx
function CreateTaskForm() {
  const { submit, state } = useAction('/dashboard/projects/:projectId');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await submit(fd); // POST to current route's action
      }}
    >
      <input name="title" />
      <button disabled={state === 'submitting'}>Create</button>
    </form>
  );
}
```

### Action → revalidate flow

```typescript
async function runAction(route: RouteNode, formData: FormData, ctx: LoaderContext) {
  if (!route.action) throw new Error('No action on route');
  const result = await route.action({ ...ctx, request: formRequest(formData) });

  // Revalidate all active loaders in the current match tree
  await revalidateLoaders(currentMatches);
  return result;
}
```

### Fetchers (mutate without navigation)

For inline edits (toggle todo, like button):

```typescript
type Fetcher = {
  submit: (data: FormData | Record<string, string>, opts?: { method?: string; action?: string }) => Promise<void>;
  state: 'idle' | 'submitting' | 'loading';
  data: unknown;
};
```

Fetchers call the same `action`/`loader` machinery but **do not** push history entries.

### Optimistic UI (optional advanced post)

Apply optimistic state immediately; roll back if action throws. Store pending mutations in a small reducer keyed by `mutationId`.

---

## Part 6: React Server Components Support

RSC changes *where* components run, not *how* URLs work. The route table and matcher must be **shared**.

### Design rules (from React team + production experience)

1. **Route matching lives outside React** — plain TS module importable on server and client ([RSC from Scratch](https://github.com/reactwg/server-components/discussions/5), [timtech.blog RSC routing notes](https://timtech.blog/posts/react-server-components-rsc-no-framework/))
2. **Don't mix Server and Client route components arbitrarily** — pick a convention per route module
3. **Two servers in full RSC setups:** RSC server (payload) + document server (HTML shell) — or unified with content negotiation

### Route module convention

```typescript
// routes/project.tsx
export async function loader({ params }: LoaderContext) {
  'use server'; // or run only on RSC server
  return db.project.find(params.projectId);
}

export async function action({ request, params }: LoaderContext) {
  'use server';
  const fd = await request.formData();
  return db.project.update(params.projectId, { title: fd.get('title') });
}

// Server Component (default export on RSC server)
export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const project = await loader({ params, request: ..., location: ... });
  return <ProjectDetail project={project} />;
}

// OR explicit ServerComponent export (React Router RSC Data Mode pattern)
export function ServerComponent({ params }: { params: { projectId: string } }) {
  ...
}
```

Client islands use `'use client'`:

```tsx
'use client';
export function ProjectLikeButton({ projectId }: { projectId: string }) {
  const fetcher = useFetcher();
  ...
}
```

### Server request handler (conceptual)

```typescript
// entry.rsc.ts — RSC payload endpoint
import { renderToPipeableStream } from 'react-server-dom-webpack/server';
import { matchRoutes, routes } from './routes';

export async function handleRSCRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const matches = matchRoutes(routes, url.pathname);
  if (!matches) return new Response('Not Found', { status: 404 });

  // Run loaders on server
  const loaderData = await runServerLoaders(matches, request);

  // Build element tree from matched Server Components
  const tree = buildRouteTree(matches, loaderData);

  return new Response(renderToPipeableStream(tree), {
    headers: { 'Content-Type': 'text/x-component' },
  });
}
```

### Client hydration + SPA navigations

```typescript
// entry.client.ts
import { createFromReadableStream } from 'react-server-dom-webpack/client';

async function navigate(path: string) {
  const res = await fetch(`/rsc?path=${encodeURIComponent(path)}`, {
    headers: { Accept: 'text/x-component' },
  });
  const payload = createFromReadableStream(res.body);
  root.render(<App rscPayload={payload} />);
}
```

### `createCallServer` — server actions from client

When a Client Component invokes a Server Function, React needs a transport:

```typescript
import { createFromFetch, createServerReference } from 'react-server-dom-webpack/client';

const callServer = createCallServer(async (id, args) => {
  const res = await fetch('/rsc/action', {
    method: 'POST',
    body: JSON.stringify({ id, args }),
  });
  return createFromFetch(res);
});

// Wire into bundler's server reference map
```

### Dual-mode `<Router>` 

| Concern | Client | Server (SSR/RSC) |
|---------|--------|------------------|
| History | `createBrowserHistory()` | `createMemoryHistory(initialUrl)` from `Request` |
| Initial match | from `window.location` | from `request.url` |
| Loaders | fetch API | direct DB / service calls |
| Component render | Client Components + hydrated RSC | Server Components via `react-server-dom-webpack` |

```typescript
export function createMemoryHistory(initial: string): History {
  let location = parseUrl(initial);
  // same interface — push/replace update in-memory stack only
}
```

### Content negotiation (single endpoint pattern)

```
GET /projects/42
  Accept: text/html        → full HTML document (SSR shell + embedded flight data)
  Accept: text/x-component → RSC payload only (client navigation)
  POST + _action           → run action, return updated flight + revalidation hints
```

---

## Putting It Together: Minimal API Surface

Target public API for your scratch router (mirrors industry conventions):

| Export | Purpose |
|--------|---------|
| `<Router>` | Provider + match renderer |
| `<Link>` / `<NavLink>` | Declarative navigation |
| `<Outlet>` | Nested child render slot |
| `useParams()` | Dynamic segments |
| `useNavigate()` | Imperative navigation |
| `useLoaderData(id?)` | Route loader result |
| `useActionData()` | Last action result |
| `useFetcher()` | Non-navigating mutations |
| `matchRoutes()` | Shared matcher (server + client) |
| `createBrowserHistory()` | Client history |
| `createMemoryHistory(url)` | SSR/RSC history |

---

## Teaching Exercises (Per Post)

1. **Part 1:** Add `useSearchParams()` parsing `location.search`
2. **Part 2:** Implement `generatePath('/users/:id', { id: '7' })` using `path-to-regexp`'s `compile`
3. **Part 3:** Add a catch-all `*` 404 route
4. **Part 4:** Race-test rapid navigation — cancel in-flight loaders with `AbortSignal`
5. **Part 5:** Build `<Form method="post">` that works without JavaScript (progressive enhancement) on SSR
6. **Part 6:** Split dev server into `/rsc` + `/` document routes

---

## What Production Routers Add (Be Honest in Posts)

| Feature | Scratch router | React Router v7 / TanStack Router |
|---------|----------------|-----------------------------------|
| Route matching | ✅ (with path-to-regexp) | ✅ + typed routes |
| Nested layouts | ✅ | ✅ |
| Loaders/actions | ✅ (manual) | ✅ + error boundaries |
| Code splitting | Manual `import()` | Built-in lazy + bundler integration |
| RSC | ✅ (manual wiring) | Experimental RSC Data/Framework modes |
| Middleware | Roll your own | ✅ |
| Devtools | None | TanStack Router Devtools |
| Battle-tested edge cases | ❌ | ✅ (relative links, basenames, etc.) |

**Narrative for readers:** Build from scratch to learn; adopt production tools to ship.

---

## LinkedIn / Medium Content Angles

### LinkedIn (short hooks)

- "I built React Router in 100 lines. Here's what I learned about `popstate`."
- "Nested routes aren't magic — they're just a tree of matches."
- "Loaders exist because `useEffect` after navigation is a race condition factory."
- "Server Components didn't replace routing — they replaced *where* your matcher runs."

### Medium series structure

- 8–12 min read each
- Single runnable CodeSandbox per part (stack: Vite + React 19 + TypeScript)
- "Before/after" diffs showing the router growing
- Final part links to a GitHub repo with all 6 parts tagged

### Blog (your site)

- Combine parts into a `/learn/react-router-internals` hub page
- Add interactive diagram (matcher tree visualization)
- SEO targets: "build react router from scratch", "react nested routes explained", "react server components routing"

---

## Reference Implementation Checklist

- [ ] `packages/core` — history, matcher, loader runner (zero React deps)
- [ ] `packages/react` — Provider, Link, Outlet, hooks
- [ ] `packages/server` — memory history, Request adapter, RSC handler
- [ ] `examples/spa` — client-only demo
- [ ] `examples/rsc` — Vite + `react-server-dom-webpack` dual entry
- [ ] Tests: matcher unit tests (no DOM), integration with jsdom + `@testing-library/react`

---

## Sources

- [Building React Router from Scratch — Dakic](https://dakic.com/topics/react-development/building-react-router-from-scratch)
- [React Starter Kit — How to Implement Routing](https://github.com/kriasoft/react-starter-kit/blob/master/docs/recipes/how-to-implement-routing.md)
- [path-to-regexp](https://github.com/pillarjs/path-to-regexp)
- [React Router — Route Object (loaders/actions)](https://reactrouter.com/start/data/route-object/)
- [React Router — Custom Framework / SSR](https://reactrouter.com/start/data/custom/)
- [React Router — React Server Components](https://reactrouter.com/how-to/react-server-components/)
- [RSC From Scratch Part 1 — reactwg](https://github.com/reactwg/server-components/discussions/5)
- [React Server Components without a framework — timtech.blog](https://timtech.blog/posts/react-server-components-rsc-no-framework/)
- [Build your own RSC Framework — nikhilsnayak.dev](https://www.nikhilsnayak.dev/blog/build-your-own-rsc-framework-part-1)
- [History API / popstate — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event)
