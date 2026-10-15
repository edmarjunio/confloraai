import { Privacy } from "./Privacy.jsx";
import { Deletion } from "./Deletion.jsx";
import { Terms } from "./Terms.jsx";
export default function LegalPage() {
  const path = location.pathname;
  if (["/privacy", "/politica-de-privacidade"].includes(path)) {
    return <Privacy />;
  }
  if (["/terms", "/termos-de-servico"].includes(path)) {
    return <Terms />;
  }
  return <Deletion />;
}
