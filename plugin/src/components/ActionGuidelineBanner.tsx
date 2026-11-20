import React from 'react';
import { usePrismexStore } from '../state/usePrismexStore';
import { CheckCircle2, AlertTriangle, X, ArrowRight, RefreshCw, HelpCircle } from 'lucide-react';

export const ActionGuidelineBanner: React.FC = () => {
  const { actionFeedback, clearActionFeedback, language } = usePrismexStore();
  const isBn = language === 'bn';

  if (!actionFeedback) return null;

  const isSuccess = actionFeedback.type === 'success';

  return (
    <div
      style={{
        margin: '6px 8px',
        padding: '8px 12px',
        borderRadius: '8px',
        backgroundColor: isSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.14)',
        border: `1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)'}`,
        boxShadow: isSuccess 
          ? '0 4px 14px rgba(16, 185, 129, 0.2)' 
          : '0 4px 14px rgba(239, 68, 68, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        zIndex: 50,
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {isSuccess ? (
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <CheckCircle2 size={13} color="#ffffff" strokeWidth={3} />
            </div>
          ) : (
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertTriangle size={12} color="#ffffff" strokeWidth={2.5} />
            </div>
          )}

          <div style={{
            fontSize: '11.5px',
            fontWeight: 700,
            color: isSuccess ? '#34d399' : '#fca5a5',
            lineHeight: 1.3
          }}>
            {actionFeedback.title}
          </div>
        </div>

        <button
          onClick={clearActionFeedback}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={isBn ? 'বন্ধ করুন' : 'Dismiss'}
        >
          <X size={14} />
        </button>
      </div>

      {/* Success Detail or Failure Diagnostic */}
      {isSuccess && actionFeedback.detail && (
        <div style={{
          fontSize: '10.5px',
          color: '#d1fae5',
          marginLeft: '28px',
          lineHeight: 1.4
        }}>
          {actionFeedback.detail}
        </div>
      )}

      {!isSuccess && (
        <div style={{
          marginLeft: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          fontSize: '10.5px',
          color: '#f8fafc'
        }}>
          {/* Reason */}
          {actionFeedback.reason && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              padding: '5px 8px',
              borderRadius: '5px',
              borderLeft: '3px solid #ef4444',
              lineHeight: 1.4
            }}>
              <span style={{ fontWeight: 700, color: '#fca5a5' }}>
                {isBn ? '🔍 সমস্যার কারণ: ' : 'Root Cause: '}
              </span>
              <span>{actionFeedback.reason}</span>
            </div>
          )}

          {/* Guideline / What to do */}
          {actionFeedback.guideline && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              padding: '5px 8px',
              borderRadius: '5px',
              borderLeft: '3px solid #f59e0b',
              lineHeight: 1.4
            }}>
              <span style={{ fontWeight: 700, color: '#fcd34d' }}>
                {isBn ? '💡 করণীয় নির্দেশনা: ' : 'Solution: '}
              </span>
              <span style={{ whiteSpace: 'pre-line' }}>{actionFeedback.guideline}</span>
            </div>
          )}

          {/* Direct Action Button */}
          {actionFeedback.actionText && actionFeedback.onAction && (
            <button
              onClick={() => {
                actionFeedback.onAction?.();
              }}
              style={{
                alignSelf: 'flex-start',
                marginTop: '3px',
                padding: '4px 10px',
                borderRadius: '5px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                fontSize: '10.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
              }}
            >
              <RefreshCw size={11} />
              <span>{actionFeedback.actionText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
