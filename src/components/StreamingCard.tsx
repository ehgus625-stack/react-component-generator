import { useEffect, useRef } from 'react';
import type { PendingComponent } from '../types';

interface StreamingCardProps {
  pending: PendingComponent;
}

// 생성 중인 컴포넌트를 "코드" 탭 상태로 보여주고, 도착하는 코드를 실시간으로 이어 붙인다.
// 생성이 끝나면 부모가 이 카드를 제거하고 미리보기 탭이 기본인 ComponentCard로 교체한다.
export function StreamingCard({ pending }: StreamingCardProps) {
  const blockRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const el = blockRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [pending.code]);

  return (
    <div className="win component-card component-card--streaming" role="status" aria-live="polite">
      <div className="win-title">
        <h2>{pending.prompt}</h2>
        <span className="win-time">생성 중...</span>
      </div>
      <div className="card-toolbar">
        <div className="card-tabs" role="tablist">
          <button role="tab" aria-selected={false} className="tab" disabled>
            미리보기
          </button>
          <button role="tab" aria-selected={true} className="tab tab--active">
            코드
          </button>
        </div>
      </div>
      <div className="card-content">
        <div className="code-panel">
          <div className="panel-header">
            <h3>코드</h3>
          </div>
          <pre className="code-block" ref={blockRef}>
            <code>
              {pending.code}
              <span className="cursor" aria-hidden="true" />
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
