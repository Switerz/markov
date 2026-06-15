import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "./cn";
import styles from "./Card.module.css";

const CardRoot = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function CardRoot({ className, ...rest }, ref) {
    return <section ref={ref} className={cn(styles.card, className)} {...rest} />;
  },
);

function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <header className={cn(styles.header, className)} {...rest} />;
}

function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn(styles.title, className)} {...rest} />;
}

function CardDescription({
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn(styles.description, className)} {...rest} />;
}

function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.body, className)} {...rest} />;
}

function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <footer className={cn(styles.footer, className)} {...rest} />;
}

type CardComponent = typeof CardRoot & {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

export const Card = CardRoot as CardComponent;
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Body = CardBody;
Card.Footer = CardFooter;
