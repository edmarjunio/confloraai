// Preserves the published policy content; presentation uses shared storefront components.
export function Terms() {
  return (
    <div className="panel legal">
      <h1>{"legal.terms.text1".tr}</h1>
      <p>
        <strong>{"legal.terms.text2".tr}</strong>
        {"legal.terms.text3".tr}
      </p>

      <h2>{"legal.terms.text4".tr}</h2>
      <p>{"legal.terms.text5".tr}</p>

      <h2>{"legal.terms.text6".tr}</h2>
      <p>{"legal.terms.text7".tr}</p>

      <h2>{"legal.terms.text8".tr}</h2>
      <p>
        {"legal.terms.text9".tr}
        <a href="mailto:edmarjuniob@gmail.com">{"legal.terms.text10".tr}</a>
        {"legal.terms.text11".tr}
      </p>
    </div>
  );
}
