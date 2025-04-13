// JSX namespace declarations for HTML elements
import React from 'react';

declare namespace JSX {
  interface IntrinsicElements {
    // HTML elements used in the application
    div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
    span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
    p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
    h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
    h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
    h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
    h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
    h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
    h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
    a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
    button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
    input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
    textarea: React.DetailedHTMLProps<React.TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement>;
    select: React.DetailedHTMLProps<React.SelectHTMLAttributes<HTMLSelectElement>, HTMLSelectElement>;
    option: React.DetailedHTMLProps<React.OptionHTMLAttributes<HTMLOptionElement>, HTMLOptionElement>;
    form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
    img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
    table: React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
    thead: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
    tbody: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>;
    tr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>;
    th: React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
    td: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
    ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
    ol: React.DetailedHTMLProps<React.OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>;
    li: React.DetailedHTMLProps<React.LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>;

    // Additional elements used in the KnowledgeBaseDashboard component
    article: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    section: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    aside: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    nav: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    header: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    footer: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    main: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    hr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHRElement>, HTMLHRElement>;
    br: React.DetailedHTMLProps<React.HTMLAttributes<HTMLBRElement>, HTMLBRElement>;
    label: React.DetailedHTMLProps<React.LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
    fieldset: React.DetailedHTMLProps<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, HTMLFieldSetElement>;
    legend: React.DetailedHTMLProps<React.HTMLAttributes<HTMLLegendElement>, HTMLLegendElement>;
    pre: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement>;
    code: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    small: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    strong: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    em: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    i: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    b: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    u: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    s: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    sub: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    sup: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    details: React.DetailedHTMLProps<React.DetailsHTMLAttributes<HTMLDetailsElement>, HTMLDetailsElement>;
    summary: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    figure: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    figcaption: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    time: React.DetailedHTMLProps<React.TimeHTMLAttributes<HTMLTimeElement>, HTMLTimeElement>;
    mark: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    dialog: React.DetailedHTMLProps<React.DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement>;
    iframe: React.DetailedHTMLProps<React.IframeHTMLAttributes<HTMLIFrameElement>, HTMLIFrameElement>;
    video: React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;
    audio: React.DetailedHTMLProps<React.AudioHTMLAttributes<HTMLAudioElement>, HTMLAudioElement>;
    source: React.DetailedHTMLProps<React.SourceHTMLAttributes<HTMLSourceElement>, HTMLSourceElement>;
    track: React.DetailedHTMLProps<React.TrackHTMLAttributes<HTMLTrackElement>, HTMLTrackElement>;
    canvas: React.DetailedHTMLProps<React.CanvasHTMLAttributes<HTMLCanvasElement>, HTMLCanvasElement>;
    embed: React.DetailedHTMLProps<React.EmbedHTMLAttributes<HTMLEmbedElement>, HTMLEmbedElement>;
    object: React.DetailedHTMLProps<React.ObjectHTMLAttributes<HTMLObjectElement>, HTMLObjectElement>;
    param: React.DetailedHTMLProps<React.ParamHTMLAttributes<HTMLParamElement>, HTMLParamElement>;
    picture: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

    // Specific elements used in KnowledgeBaseDashboard.tsx
    dl: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDListElement>, HTMLDListElement>;
    dt: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    dd: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

    // SVG elements
    svg: React.SVGProps<SVGSVGElement>;
    path: React.SVGProps<SVGPathElement>;
    circle: React.SVGProps<SVGCircleElement>;
    ellipse: React.SVGProps<SVGEllipseElement>;
    line: React.SVGProps<SVGLineElement>;
    polygon: React.SVGProps<SVGPolygonElement>;
    polyline: React.SVGProps<SVGPolylineElement>;
    rect: React.SVGProps<SVGRectElement>;
    g: React.SVGProps<SVGGElement>;
    defs: React.SVGProps<SVGDefsElement>;
    clipPath: React.SVGProps<SVGClipPathElement>;
    mask: React.SVGProps<SVGMaskElement>;
    pattern: React.SVGProps<SVGPatternElement>;
    filter: React.SVGProps<SVGFilterElement>;
    feBlend: React.SVGProps<SVGFEBlendElement>;
    feColorMatrix: React.SVGProps<SVGFEColorMatrixElement>;
    feComponentTransfer: React.SVGProps<SVGFEComponentTransferElement>;
    feComposite: React.SVGProps<SVGFECompositeElement>;
    feConvolveMatrix: React.SVGProps<SVGFEConvolveMatrixElement>;
    feDiffuseLighting: React.SVGProps<SVGFEDiffuseLightingElement>;
    feDisplacementMap: React.SVGProps<SVGFEDisplacementMapElement>;
    feDistantLight: React.SVGProps<SVGFEDistantLightElement>;
    feDropShadow: React.SVGProps<SVGFEDropShadowElement>;
    feFlood: React.SVGProps<SVGFEFloodElement>;
    feFuncA: React.SVGProps<SVGFEFuncAElement>;
    feFuncB: React.SVGProps<SVGFEFuncBElement>;
    feFuncG: React.SVGProps<SVGFEFuncGElement>;
    feFuncR: React.SVGProps<SVGFEFuncRElement>;
    feGaussianBlur: React.SVGProps<SVGFEGaussianBlurElement>;
    feImage: React.SVGProps<SVGFEImageElement>;
    feMerge: React.SVGProps<SVGFEMergeElement>;
    feMergeNode: React.SVGProps<SVGFEMergeNodeElement>;
    feMorphology: React.SVGProps<SVGFEMorphologyElement>;
    feOffset: React.SVGProps<SVGFEOffsetElement>;
    fePointLight: React.SVGProps<SVGFEPointLightElement>;
    feSpecularLighting: React.SVGProps<SVGFESpecularLightingElement>;
    feSpotLight: React.SVGProps<SVGFESpotLightElement>;
    feTile: React.SVGProps<SVGFETileElement>;
    feTurbulence: React.SVGProps<SVGFETurbulenceElement>;
    linearGradient: React.SVGProps<SVGLinearGradientElement>;
    radialGradient: React.SVGProps<SVGRadialGradientElement>;
    stop: React.SVGProps<SVGStopElement>;
    text: React.SVGProps<SVGTextElement>;
    textPath: React.SVGProps<SVGTextPathElement>;
    tspan: React.SVGProps<SVGTSpanElement>;
    use: React.SVGProps<SVGUseElement>;

    // Catch-all for any other elements
    [elemName: string]: any;
  }

  // Add interface for Element to avoid 'JSX element implicitly has type any' errors
  interface Element extends React.ReactElement<any, any> { }

  // Add interface for ElementClass to avoid 'JSX element class does not support attributes' errors
  interface ElementClass extends React.Component<any> {
    render(): React.ReactNode;
  }

  // Add interface for ElementAttributesProperty to avoid 'JSX element attributes type' errors
  interface ElementAttributesProperty {
    props: {};
  }

  // Add interface for ElementChildrenAttribute to avoid 'JSX element children' errors
  interface ElementChildrenAttribute {
    children: {};
  }
}
