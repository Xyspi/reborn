import React from 'react';
import { Loader2, Search, FileText, Zap } from 'lucide-react';

interface HtmlParsingProgressProps {
  isVisible: boolean;
  progress: number;
  stage: 'analyzing' | 'detecting' | 'converting' | 'complete';
  currentUrl?: string;
  potentialCallouts?: number;
  textPatterns?: number;
}

const stageInfo = {
  analyzing: {
    icon: Search,
    title: 'Analyse HTML en cours',
    description: 'Examination de la structure HTML de la page...'
  },
  detecting: {
    icon: Zap,
    title: 'Détection des callouts',
    description: 'Recherche des éléments info, warning, exemple...'
  },
  converting: {
    icon: FileText,
    title: 'Conversion Obsidian',
    description: 'Application des formats Admonitions...'
  },
  complete: {
    icon: FileText,
    title: 'Parsing terminé',
    description: 'Conversion vers Obsidian terminée avec succès'
  }
};

export function HtmlParsingProgress({
  isVisible,
  progress,
  stage,
  currentUrl,
  potentialCallouts,
  textPatterns
}: HtmlParsingProgressProps) {
  if (!isVisible) return null;

  const StageIcon = stageInfo[stage].icon;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '1.5rem',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 255, 136, 0.3)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <div style={{ position: 'relative' }}>
            <StageIcon style={{ 
              width: '24px', 
              height: '24px', 
              color: '#00ff88' 
            }} />
            {stage !== 'complete' && (
              <Loader2 style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '16px',
                height: '16px',
                animation: 'spin 1s linear infinite',
                color: '#00ff88'
              }} />
            )}
          </div>
          <div>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              color: '#fff',
              margin: '0 0 0.25rem 0'
            }}>
              {stageInfo[stage].title}
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: '#888',
              margin: 0
            }}>
              {stageInfo[stage].description}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            marginBottom: '0.5rem'
          }}>
            <span style={{ color: '#ccc' }}>Progression</span>
            <span style={{ 
              fontWeight: '500', 
              color: '#00ff88' 
            }}>
              {Math.round(progress)}%
            </span>
          </div>
          
          <div style={{
            backgroundColor: '#333',
            borderRadius: '8px',
            height: '8px',
            overflow: 'hidden'
          }}>
            <div style={{
              backgroundColor: '#00ff88',
              height: '100%',
              width: `${progress}%`,
              transition: 'width 0.3s ease',
              borderRadius: '8px'
            }} />
          </div>
          
          {currentUrl && (
            <div style={{
              fontSize: '0.75rem',
              color: '#666',
              marginTop: '0.5rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {currentUrl}
            </div>
          )}

          {(potentialCallouts !== undefined || textPatterns !== undefined) && (
            <div style={{
              marginTop: '1rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #333'
            }}>
              <h4 style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#00ff88',
                marginBottom: '0.5rem'
              }}>
                🔍 Analyse détectée
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                fontSize: '0.875rem'
              }}>
                {potentialCallouts !== undefined && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#00ff88',
                      borderRadius: '50%'
                    }} />
                    <span style={{ color: '#ccc' }}>
                      {potentialCallouts} callouts HTML
                    </span>
                  </div>
                )}
                {textPatterns !== undefined && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#ff8800',
                      borderRadius: '50%'
                    }} />
                    <span style={{ color: '#ccc' }}>
                      {textPatterns} patterns texte
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {stage === 'complete' && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(0, 255, 136, 0.3)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                backgroundColor: '#00ff88',
                borderRadius: '50%'
              }} />
              <span style={{
                fontSize: '0.875rem',
                color: '#00ff88',
                fontWeight: '500'
              }}>
                Conversion Obsidian terminée
              </span>
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}