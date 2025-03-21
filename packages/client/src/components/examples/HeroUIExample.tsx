import React, { useState } from 'react';
import heroUITheme from '../../theme/heroui-theme';

/**
 * HeroUI Example Component
 * 
 * This component demonstrates how to use HeroUI components and styling.
 * It serves as a template for future components that should use HeroUI.
 * 
 * Note: In a real integration, you would directly import HeroUI components:
 * import { Button, Card, TextField } from '@heroui/react';
 */
const HeroUIExample: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  
  // Handle form submission
  const handleSubmit = (e: any) => {
    e.preventDefault();
    setSubmitted(true);
    // Process form data
  };
  
  // Handle input change
  const handleInputChange = (e: any) => {
    setInputValue(e.target.value);
  };
  
  // Theme colors from our HeroUI theme
  const { colors } = heroUITheme;
  
  // Simulate HeroUI styling using regular HTML elements with inline styles
  // In a real integration, you would use actual HeroUI components
  return (
    <div style={{ 
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <div style={{ 
        color: colors.primary.main,
        fontFamily: heroUITheme.typography.fontFamily,
        fontSize: heroUITheme.typography.h2.fontSize as string,
        fontWeight: 500,
        marginBottom: '1rem'
      }}>
        HeroUI Component Example
      </div>
      
      <div style={{ 
        color: colors.text.primary,
        fontFamily: heroUITheme.typography.fontFamily,
        fontSize: heroUITheme.typography.body1.fontSize as string,
        marginBottom: '1.5rem'
      }}>
        This example demonstrates how to build components using HeroUI. In a real implementation,
        you would use actual HeroUI components instead of styled HTML elements.
      </div>
      
      {/* Example Card - would be <Card> from HeroUI */}
      <div style={{ 
        backgroundColor: colors.background.paper,
        borderRadius: `${heroUITheme.shape.borderRadius}px`,
        padding: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ 
          color: colors.primary.dark,
          fontFamily: heroUITheme.typography.fontFamily,
          fontSize: heroUITheme.typography.h3.fontSize as string,
          fontWeight: 'bold',
          marginTop: 0,
          marginBottom: '1rem'
        }}>
          Sample Card
        </div>
        
        <div style={{ 
          color: colors.text.secondary,
          fontFamily: heroUITheme.typography.fontFamily,
          fontSize: heroUITheme.typography.body2.fontSize as string
        }}>
          This would be a HeroUI Card component in the actual implementation.
          It demonstrates the use of theme colors, typography, and spacing.
        </div>
        
        {/* Example Form - Using div with role="form" instead of form element */}
        <div role="form" onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
          {/* Example Text Field - would be <TextField> from HeroUI */}
          <div style={{ marginBottom: '1rem' }}>
            <div 
              style={{ 
                display: 'block',
                marginBottom: '0.5rem',
                color: colors.text.primary,
                fontFamily: heroUITheme.typography.fontFamily,
                fontSize: heroUITheme.typography.body2.fontSize as string
              }}
            >
              Example Input
            </div>
            <div
              role="textbox"
              tabIndex={0}
              style={{ 
                width: '100%',
                padding: '0.75rem',
                borderRadius: `${heroUITheme.shape.borderRadius}px`,
                border: `1px solid ${colors.primary.light}`,
                fontFamily: heroUITheme.typography.fontFamily,
                fontSize: heroUITheme.typography.body1.fontSize as string,
                boxSizing: 'border-box',
                backgroundColor: 'white',
                cursor: 'text'
              }}
            >
              {inputValue || 'Enter some text'}
            </div>
          </div>
          
          {/* Example Button - would be <Button> from HeroUI */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleSubmit}
            onKeyDown={(e: any) => e.key === 'Enter' && handleSubmit(e)}
            style={{ 
              display: 'inline-block',
              backgroundColor: colors.primary.main,
              color: colors.primary.contrastText,
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: `${heroUITheme.shape.borderRadius}px`,
              fontFamily: heroUITheme.typography.fontFamily,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: `background-color ${heroUITheme.transitions.duration.short}ms`,
              marginRight: '1rem',
              userSelect: 'none'
            }}
          >
            Submit
          </div>
          
          {/* Example Secondary Button - would be <Button variant="outlined"> from HeroUI */}
          <div
            role="button"
            tabIndex={0}
            style={{ 
              display: 'inline-block',
              backgroundColor: 'transparent',
              color: colors.secondary.main,
              padding: '0.75rem 1.5rem',
              border: `1px solid ${colors.secondary.main}`,
              borderRadius: `${heroUITheme.shape.borderRadius}px`,
              fontFamily: heroUITheme.typography.fontFamily,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: `background-color ${heroUITheme.transitions.duration.short}ms`,
              userSelect: 'none'
            }}
          >
            Cancel
          </div>
        </div>
        
        {/* Example Alert - would be <Alert> from HeroUI */}
        {submitted && (
          <div style={{ 
            backgroundColor: colors.success.light,
            color: colors.success.dark,
            padding: '1rem',
            borderRadius: `${heroUITheme.shape.borderRadius}px`,
            marginTop: '1rem',
            fontFamily: heroUITheme.typography.fontFamily,
            fontSize: heroUITheme.typography.body2.fontSize as string
          }}>
            Form submitted successfully!
          </div>
        )}
      </div>
      
      {/* Usage Instructions */}
      <div style={{ 
        backgroundColor: colors.info.light,
        color: colors.info.dark,
        padding: '1rem',
        borderRadius: `${heroUITheme.shape.borderRadius}px`,
        fontFamily: heroUITheme.typography.fontFamily,
        fontSize: heroUITheme.typography.body2.fontSize as string
      }}>
        <span style={{ fontWeight: 'bold' }}>Developer Note:</span> When building new components, import and use HeroUI components
        directly. For example:
        <div style={{ 
          backgroundColor: '#f5f5f5',
          padding: '0.5rem',
          borderRadius: '4px',
          overflow: 'auto',
          fontFamily: 'monospace',
          whiteSpace: 'pre'
        }}>
{`// Import HeroUI components
import { Button, Card, TextField } from '@heroui/react';

// Use them in your JSX
<Card>
  <TextField label="Example" />
  <Button variant="contained">Submit</Button>
</Card>`}
        </div>
      </div>
    </div>
  );
};

export default HeroUIExample;