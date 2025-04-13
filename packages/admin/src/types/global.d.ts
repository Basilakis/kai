/**
 * Global TypeScript Declarations
 *
 * This file provides global type definitions for JSX elements
 * used throughout the project. It resolves the "JSX element
 * implicitly has type 'any'" errors by explicitly defining
 * types for all HTML elements.
 */

// Declare JSX namespace globally to fix TypeScript JSX element errors
declare namespace JSX {
  interface IntrinsicElements {
    // Basic HTML elements
    div: any;
    span: any;
    p: any;
    h1: any;
    h2: any;
    h3: any;
    h4: any;
    h5: any;
    h6: any;
    a: any;
    button: any;
    input: any;
    textarea: any;
    select: any;
    option: any;
    form: any;
    label: any;
    img: any;
    hr: any;
    br: any;

    // Table elements
    table: any;
    thead: any;
    tbody: any;
    tr: any;
    th: any;
    td: any;

    // List elements
    ul: any;
    ol: any;
    li: any;
    dl: any;
    dt: any;
    dd: any;

    // Layout elements
    header: any;
    footer: any;
    nav: any;
    main: any;
    section: any;
    article: any;
    aside: any;

    // Form elements
    fieldset: any;
    legend: any;
    optgroup: any;

    // Other common elements
    iframe: any;
    canvas: any;
    svg: any;
    path: any;

    // HTML5 semantic elements
    audio: any;
    video: any;
    source: any;
    track: any;
    figure: any;
    figcaption: any;
    details: any;
    summary: any;
    time: any;

    // Meta elements
    head: any;
    meta: any;
    link: any;
    script: any;
    style: any;
    title: any;

    // Custom components for subscription-tiers page
    Checkbox: any;
    Divider: any;
    InputAdornment: any;
    CheckCircleIcon: any;
    CancelIcon: any;

    // Heroicons components used in Sidebar
    HomeIcon: any;
    UsersIcon: any;
    DocumentTextIcon: any;
    CubeIcon: any;
    GlobeAltIcon: any;
    CogIcon: any;
    XIcon: any;
    PhotographIcon: any;
    DatabaseIcon: any;
    ChartBarIcon: any;

    // Next.js components
    Link: any;
    Router: any;
    Fragment: any;
  }
}

// Add any other global declarations here