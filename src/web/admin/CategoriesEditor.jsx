import { Field } from "../shared/ui.jsx";
export function CategoriesEditor({ categories, onChange }) {
  function update(index, patch) {
    onChange(
      categories.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }
  return (
    <fieldset>
      <legend>{"catalog.categories".tr}</legend>
      {categories.map((category, index) => (
        <div className="toolbar" key={category.id}>
          <Field
            label={"catalog.name".tr}
            value={category.name}
            onChange={(event) => update(index, { name: event.target.value })}
          />
          <Field
            label={"catalog.subcategory".tr}
            value={(category.subcategories || []).join(", ")}
            onChange={(event) =>
              update(index, {
                subcategories: event.target.value
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
              })
            }
          />
          <label>
            <input
              type="checkbox"
              checked={category.isActive}
              onChange={(event) =>
                update(index, { isActive: event.target.checked })
              }
            />
            {"status.active".tr}
          </label>
          <button
            type="button"
            onClick={() => onChange(categories.filter((_, i) => i !== index))}
          >
            {"common.remove".tr}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([
            ...categories,
            {
              id: crypto.randomUUID(),
              name: "",
              subcategories: [],
              isActive: true,
              order: categories.length,
            },
          ])
        }
      >
        {"common.add".tr}
      </button>
    </fieldset>
  );
}
