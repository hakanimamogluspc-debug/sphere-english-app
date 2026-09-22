import type { ComponentType } from "react";
import ModuleIntro from "./ModuleIntro";

/**
 * withModuleIntro — Modül tanıtım wizard'ını her sayfaya tek satırda ekleyen HOC.
 *
 * Kullanım:
 *   import { withModuleIntro } from "@/components/withModuleIntro";
 *   function WritingCoach() { ... }
 *   export default withModuleIntro("writing_coach")(WritingCoach);
 *
 * moduleKey — locales/tr/modules.json'daki namespace key'i.
 *
 * Davranış:
 *   - İlk sayfa girişinde tanıtım modal'ı otomatik açılır (localStorage kontrol)
 *   - Sağ üst köşede "?" butonu her zaman görünür — kullanıcı tekrar açabilir
 *   - Sayfa içeriği modal'ın arkasında normal render edilir (kesinti yok)
 */
export function withModuleIntro<P extends object>(moduleKey: string) {
  return function wrap(Component: ComponentType<P>) {
    function ComponentWithModuleIntro(props: P) {
      return (
        <>
          <ModuleIntro moduleKey={moduleKey} />
          <Component {...props} />
        </>
      );
    }
    ComponentWithModuleIntro.displayName = `withModuleIntro(${Component.displayName ?? Component.name ?? "Component"})`;
    return ComponentWithModuleIntro;
  };
}
