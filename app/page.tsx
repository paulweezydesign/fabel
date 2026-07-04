import { AGENT_TYPES } from '@/core/agent-types';

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem', maxWidth: 640 }}>
      <h1>Fabel</h1>
      <p>V1 Agent-Powered Agency Platform.</p>
      <p>
        Agents are available via <code>POST /api/agents/&lt;type&gt;/run</code>:
      </p>
      <ul>
        {AGENT_TYPES.map((type) => (
          <li key={type}>
            <code>{type}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
