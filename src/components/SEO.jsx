import { Helmet } from "react-helmet-async";

const defaultTitle = "Before I do – The Singles Experience Registration";
const defaultDescription = "Register for Before I do – The Singles Experience.";

export function SEO({
  title = defaultTitle,
  description = defaultDescription,
  image = "/background.jpeg",
  url = "",
}) {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      {url && <meta property="og:url" content={url} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
