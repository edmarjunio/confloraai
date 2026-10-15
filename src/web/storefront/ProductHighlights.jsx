function definitions() {
  return [
    {
      label: "store.sun".tr,
      icon: "☀",
      tone: "sun",
      terms: ["sol pleno", "pleno sol"],
    },
    {
      label: "store.partialShade".tr,
      icon: "◐",
      tone: "shade",
      terms: ["meia sombra", "luz indireta"],
    },
    {
      label: "store.shade".tr,
      icon: "☾",
      tone: "shade",
      terms: ["sombra"],
      exclude: "meia sombra",
    },
    {
      label: "store.watered".tr,
      icon: "💧",
      tone: "water",
      terms: ["irrigado", "solo umido", "solo humido"],
    },
    {
      label: "store.aquatic".tr,
      icon: "💧",
      tone: "water",
      terms: ["aquatico", "aquatica"],
    },
    {
      label: "store.bird".tr,
      icon: "✦",
      tone: "pet",
      terms: ["ave exotica", "ave ornamental"],
    },
    {
      label: "store.pet".tr,
      icon: "🐾",
      tone: "pet",
      terms: ["pet friendly", "seguro para pets"],
    },
    {
      label: "store.fruit".tr,
      icon: "●",
      tone: "fruit",
      terms: ["frutifera", "frutifero"],
    },
    {
      label: "store.flower".tr,
      icon: "✿",
      tone: "flower",
      terms: ["florifera", "florifero", "flores ornamentais"],
    },
  ];
}

export function ProductHighlights({ product }) {
  const text = [
    product.name,
    product.categoryName,
    product.subcategoryName,
    product.description,
    product.descriptionAi,
    product.descricao_ia,
    ...(Array.isArray(product.tags) ? product.tags : []),
    ...(Array.isArray(product.searchAliases) ? product.searchAliases : []),
    product.ambiente_ideal,
    product.cuidados_basicos,
    ...Object.values(product.specifications || {}).flatMap((spec) => [
      spec?.label,
      spec?.value,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
  const highlights = definitions()
    .filter(
      (item) =>
        (!item.exclude || !text.includes(item.exclude)) &&
        item.terms.some((term) => text.includes(term)),
    )
    .slice(0, 2);
  if (!highlights.length) {
    return null;
  }
  return (
    <div className="product-feature-tags">
      {highlights.map((item) => (
        <span key={item.label} className={`product-feature-tag ${item.tone}`}>
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
}
