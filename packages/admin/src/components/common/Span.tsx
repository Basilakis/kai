import React from 'react';

interface SpanProps {
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * A simple span wrapper component to avoid TypeScript JSX issues
 */
const Span: React.FC<SpanProps> = ({ style, children }) => {
  return <span style={style}>{children}</span>;
};

export default Span;
