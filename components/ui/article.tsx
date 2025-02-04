import * as React from "react"

interface ArticleProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode
}

export function Article({ className, children, ...props }: ArticleProps) {
  return (
    <article className="uk-article" {...props}>
      {children}
    </article>
  )
}

export function ArticleTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1 className="uk-article-title" {...props}>
      {children}
    </h1>
  )
}

export function ArticleMeta({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className="uk-article-meta uk-margin" {...props}>
      {children}
    </p>
  )
}

export function ArticleLead({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className="uk-margin uk-text-lead" {...props}>
      {children}
    </p>
  )
}

export function ArticleContent({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className="uk-margin" {...props}>
      {children}
    </p>
  )
}

export function ArticleActions({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="uk-grid uk-grid-small uk-margin uk-child-width-auto" data-uk-grid {...props}>
      {children}
    </div>
  )
}

export function ArticleButton({ className, href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <div>
      <a className="uk-button uk-button-text" href={href} {...props}>
        {children}
      </a>
    </div>
  )
}
