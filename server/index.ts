import { buildFinalCode } from './generator';
import { parseAnthropicEvent, extractGoogleDelta, readSseStream, toErrorPayload } from './stream';
import { withModelFallback } from './fallback';

// 우선순위 순서. 앞 모델이 실패하면 다음 모델로 폴백한다.
const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];

const SYSTEM_PROMPT = `You are a React component generator. Generate a single React component based on the user's description.

Rules:
- Use inline styles only (no CSS imports, no CSS modules)
- Do NOT use import statements — React is already available in scope as a global
- Define the component as a function, then call render(<ComponentName />) at the end
- Make the component visually appealing with proper styling
- Use React hooks if needed (e.g., React.useState, React.useEffect)
- The component must be completely self-contained
- Respond with ONLY the code block — no explanations, no markdown fences
- Use descriptive variable names and clean formatting
- For colors, prefer modern palettes (gradients, shadows, etc.)
- Ensure the component is interactive where appropriate (hover states, click handlers, etc.)
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no generics, no "as" casts. Write plain JavaScript only.

Example output format:
const GradientButton = () => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #764ba2, #667eea)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Click me
    </button>
  );
};

render(<GradientButton />);`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Provider = 'anthropic' | 'google';

const ENV_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
};

function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}

type Emit = (event: Record<string, unknown>) => void;

async function streamAnthropic(
  prompt: string,
  apiKey: string,
  emit: Emit,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  if (!response.body) throw new Error('응답 스트림이 없습니다.');

  let full = '';
  let stopped = false;
  await readSseStream(response.body, (data) => {
    const { text, stop } = parseAnthropicEvent(data);
    if (stop) stopped = true;
    if (text) {
      full += text;
      emit({ type: 'delta', text });
    }
  });
  if (!stopped) throw new Error('응답 스트림이 중간에 끊겼습니다. 다시 시도해주세요.');
  return full;
}

async function streamGoogleModel(
  prompt: string,
  apiKey: string,
  model: string,
  emit: Emit,
  signal: AbortSignal,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  if (!response.body) throw new Error('응답 스트림이 없습니다.');

  // 폴백 재시도 시 클라이언트가 앞선 부분 코드를 버리도록 알린다.
  emit({ type: 'reset' });

  let full = '';
  let truncated = false;
  await readSseStream(response.body, (data) => {
    const { text, truncated: t } = extractGoogleDelta(data);
    if (t) truncated = true;
    if (text) {
      full += text;
      emit({ type: 'delta', text });
    }
  });

  if (truncated) {
    throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
  }
  return full;
}

async function streamGoogle(
  prompt: string,
  apiKey: string,
  emit: Emit,
  signal: AbortSignal,
): Promise<string> {
  return withModelFallback(GOOGLE_MODELS, (model) => {
    // 클라이언트가 끊겼으면 다음 폴백 모델을 시도하지 않는다.
    if (signal.aborted) throw new Error('요청이 취소되었습니다.');
    return streamGoogleModel(prompt, apiKey, model, emit, signal);
  });
}

const server = Bun.serve({
  port: 3002,
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, apiKey, provider = 'anthropic' } = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
        };

        const resolvedKey = resolveApiKey(provider, apiKey);

        if (!resolvedKey) {
          return Response.json(
            { error: `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!prompt) {
          return Response.json(
            { error: 'Prompt is required' },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        // NDJSON 스트림: delta(코드 조각) / reset(폴백 재시도) / done(최종 코드) / error
        const encoder = new TextEncoder();
        const abort = new AbortController();
        const stream = new ReadableStream({
          async start(controller) {
            // 클라이언트가 끊어 스트림이 닫힌 뒤의 enqueue/close 예외는 무시한다.
            const emit: Emit = (event) => {
              try {
                controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
              } catch {
                // 이미 취소된 스트림
              }
            };
            try {
              const text =
                provider === 'google'
                  ? await streamGoogle(prompt, resolvedKey, emit, abort.signal)
                  : await streamAnthropic(prompt, resolvedKey, emit, abort.signal);
              emit({ type: 'done', code: buildFinalCode(text) });
            } catch (err) {
              emit({ type: 'error', ...toErrorPayload(err) });
            } finally {
              try {
                controller.close();
              } catch {
                // 이미 취소된 스트림
              }
            }
          },
          cancel() {
            abort.abort();
          },
        });

        return new Response(stream, {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (err) {
        const { error, status } = toErrorPayload(err);
        return Response.json({ error }, { status, headers: CORS_HEADERS });
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  },
});

console.log(`API server running at http://localhost:${server.port}`);
