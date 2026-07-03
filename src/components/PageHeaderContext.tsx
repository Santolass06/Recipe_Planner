import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PageHeaderState {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

interface PageHeaderContextType extends PageHeaderState {
  setHeader: (state: PageHeaderState) => void;
}

const PageHeaderContext = createContext<PageHeaderContextType>({
  title: "",
  setHeader: () => {},
});

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PageHeaderState>({ title: "" });
  const setHeader = useCallback((next: PageHeaderState) => setState(next), []);
  return (
    <PageHeaderContext.Provider value={{ ...state, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeaderContext() {
  return useContext(PageHeaderContext);
}
