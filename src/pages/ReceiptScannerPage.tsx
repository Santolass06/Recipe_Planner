import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "../components/ui/Toast";
import { createWorker } from "tesseract.js";

interface Ingredient {
  id: number;
  name: string;
  unit: string;
  price_per_unit: number;
}

interface Supplier {
  id: number;
  name: string;
}

interface ParsedLine {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  is_discount: boolean;
  discount_percent: number;
  confidence: number;
}

const UNIT_LABELS: Record<string, string> = {
  gram: "g", kilogram: "kg", milliliter: "ml", liter: "l",
  piece: "pcs", pack: "pack", bottle: "bottle", box: "box",
  can: "can", jar: "jar", bag: "bag", sachet: "sachet",
};

const UNIT_ALIASES: Record<string, string[]> = {
  gram: ["g", "gr", "gram", "grams", "grama", "gramas"],
  kilogram: ["kg", "kilo", "kilos", "quilograma", "quilogramas"],
  milliliter: ["ml", "milliliter", "milliliters", "mililitro", "mililitros"],
  liter: ["l", "lt", "liter", "liters", "litro", "litros"],
  piece: ["pcs", "pc", "piece", "pieces", "un", "unidade", "unidades", "unid"],
  pack: ["pack", "pacote", "pacotes", "pk", "pkg"],
  bottle: ["bottle", "bottles", "garrafa", "garrafas", "btl"],
  box: ["box", "boxes", "caixa", "caixas", "bx"],
  can: ["can", "cans", "lata", "latas", "tn"],
  jar: ["jar", "jars", "frasco", "frascos"],
  bag: ["bag", "bags", "saco", "sacos"],
  sachet: ["sachet", "sachets", "saqueta", "saquetas"],
};

export default function ReceiptScannerPage() {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | "">("");
  const [processing, setProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>("Aguardar imagem…");
  const { showToast } = useToast();
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<any>(null);

  useEffect(() => {
    loadIngredients();
    loadSuppliers();
    initWorker();
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const initWorker = async () => {
    try {
      const worker = await createWorker("por", 1, {
        logger: (m: any) => {
          if (m.status === "recognizing text") {
            setOcrProgress(`OCR: ${Math.round(m.progress * 100)}%`);
          } else if (m.status) {
            setOcrProgress(m.status);
          }
        },
      });
      workerRef.current = worker;
      setOcrProgress("Modelo OCR pronto");
    } catch (e) {
      setOcrProgress("Erro ao carregar OCR");
      showToast("Falha ao inicializar Tesseract.js", "err");
    }
  };

  const loadIngredients = async () => {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch { showToast("Erro ao carregar ingredientes", "err"); }
  };

  const loadSuppliers = async () => {
    try {
      const data = await invoke<Supplier[]>("suppliers_list");
      setSuppliers(data);
    } catch { showToast("Erro ao carregar fornecedores", "err"); }
  };

  const parseReceiptText = (text: string): ParsedLine[] => {
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 2);
    const results: ParsedLine[] = [];

    const priceRegex = /(\d+[.,]\d{2})\s*[€$]?/g;
    const qtyUnitRegex = /(\d+[.,]?\d*)\s*(g|kg|ml|l|pcs|pc|un|unid|unidade|pack|pacote|bottle|garrafa|box|caixa|can|lata|jar|frasco|bag|saco|sachet|saqueta)/gi;

    for (const line of lines) {
      const prices = [...line.matchAll(priceRegex)].map(m => parseFloat(m[1].replace(",", ".")));
      const qtyMatches = [...line.matchAll(qtyUnitRegex)];
      const lastPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
      const firstQtyMatch = qtyMatches[0];

      let qty = 1;
      let unit = "piece";
      if (firstQtyMatch) {
        qty = parseFloat(firstQtyMatch[1].replace(",", "."));
        const matchedUnit = firstQtyMatch[2].toLowerCase();
        for (const [stdUnit, aliases] of Object.entries(UNIT_ALIASES)) {
          if (aliases.includes(matchedUnit)) { unit = stdUnit; break; }
        }
      }

      let name = line;
      if (firstQtyMatch) name = name.replace(firstQtyMatch[0], "").trim();
      prices.forEach(p => { name = name.replace(p.toString().replace(".", ","), "").trim(); });
      name = name.replace(/^[\d\s\.\-\*\+]+/, "").replace(/[€$]/g, "").trim();

      if (name.length < 3 || lastPrice === 0) continue;

      const isDiscount = /promo|desconto|oferta|sale|-%/i.test(line);
      let discountPercent = 0;
      const discountMatch = line.match(/(\d+)\s*%/);
      if (discountMatch) discountPercent = parseInt(discountMatch[1]);

      const existingIng = ingredients.find(i =>
        i.name.toLowerCase().includes(name.toLowerCase().split(" ")[0]) ||
        name.toLowerCase().includes(i.name.toLowerCase().split(" ")[0])
      );

      results.push({
        name: existingIng?.name ?? name,
        quantity: qty,
        unit: existingIng?.unit ?? unit,
        price: lastPrice,
        is_discount: isDiscount,
        discount_percent: discountPercent,
        confidence: existingIng ? 0.9 : 0.5,
      });
    }

    return results;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Seleciona um ficheiro de imagem", "warn");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => { setImage(ev.target?.result as string); setParsedLines([]); setShowResults(false); };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();
      await new Promise(r => { video.onloadeddata = r; });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      stream.getTracks().forEach(t => t.stop());
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setImage(dataUrl);
      const blob = await (await fetch(dataUrl)).blob();
      setImageFile(new File([blob], "receipt.jpg", { type: "image/jpeg" }));
      setParsedLines([]);
      setShowResults(false);
    } catch (e) {
      showToast("Erro ao aceder à câmara", "err");
    }
  };

  const runOCR = async () => {
    if (!imageFile || !workerRef.current) return;
    setProcessing(true);
    setOcrProgress("A processar…");
    try {
      const { data: { text } } = await workerRef.current.recognize(imageFile);
      const parsed = parseReceiptText(text);
      setParsedLines(parsed);
      setShowResults(true);
      setOcrProgress(`${parsed.length} linhas detectadas`);
      showToast(`${parsed.length} itens extraídos`, parsed.length > 0 ? "ok" : "warn");
    } catch (e) {
      showToast("Erro no OCR", "err");
      setOcrProgress("Erro no OCR");
    } finally {
      setProcessing(false);
    }
  };

  const updateLine = (idx: number, field: keyof ParsedLine, value: any) => {
    setParsedLines(l => l.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const findOrCreateIngredient = async (line: ParsedLine): Promise<number> => {
    let ing = ingredients.find(i => i.name.toLowerCase() === line.name.toLowerCase());
    if (ing) return ing.id;
    try {
      const newIngredient = await invoke<{ id: number }>("ingredient_create", {
        input: {
          name: line.name,
          unit: line.unit,
          price_per_unit: line.price,
          category: "outros",
        },
      });
      const newId = newIngredient.id;
      await loadIngredients();
      return newId;
    } catch { throw new Error(`Falha ao criar ingrediente: ${line.name}`); }
  };

  const confirmImport = async () => {
    if (parsedLines.length === 0) { showToast("Nada para importar", "warn"); return; }
    setProcessing(true);
    try {
      for (const line of parsedLines) {
        const ingId = await findOrCreateIngredient(line);
        const total = line.quantity * line.price;
        await invoke("stock_purchase_add", {
          input: {
            ingredient_id: ingId,
            quantity: line.quantity,
            unit: line.unit,
            price_per_unit: line.price,
            total_price: total,
            is_discount: line.is_discount,
            discount_percent: line.discount_percent,
            purchase_date: new Date().toISOString(),
            supplier_id: selectedSupplier ? selectedSupplier : null,
            notes: "Importado via OCR de talão",
          },
        });
      }
      showToast(`${parsedLines.length} compras registadas e stock actualizado`, "ok");
      setParsedLines([]);
      setShowResults(false);
      setImage(null);
      setImageFile(null);
    } catch (e) {
      showToast("Erro ao importar", "err");
    } finally {
      setProcessing(false);
    }
  };

  const resetAll = () => {
    setImage(null);
    setImageFile(null);
    setParsedLines([]);
    setShowResults(false);
    setSelectedSupplier("");
    setOcrProgress("Aguardar imagem…");
  };

  return (
    <div className="content">
      <div className="content-header">
        <div>
          <h1 className="content-title">Scanner de Talões</h1>
          <p className="content-sub">OCR local via Tesseract.js</p>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={resetAll} disabled={!image && parsedLines.length === 0}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
          </svg>
          Novo scan
        </button>
      </div>

      {!image && !showResults && (
        <div className="card" style={{ maxWidth: "480px", margin: "40px auto 0", border: "2px dashed var(--border-mid)", borderRadius: "var(--radius-lg)", padding: "40px 24px", textAlign: "center", color: "var(--text-2)" }}>
          <div style={{ width: 32, height: 32, margin: "0 auto 16px" }}>
            <svg className="empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <h2 className="empty-title">Carrega um talão ou tirar foto</h2>
          <p className="empty-desc" style={{ margin: "12px 0 20px", lineHeight: 1.6 }}>Suporta JPG, PNG, WebP. O OCR corre localmente no browser via Tesseract.js (português).</p>
          <div style={{ display: "flex", flexDirection: "row", gap: "8px", justifyContent: "center", marginTop: "24px" }}>
            <label className="btn" style={{ cursor: "pointer" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Escolher ficheiro
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />
            </label>
            <button className="btn" onClick={handleCameraCapture}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="12" r="4"/></svg>
              Tirar foto
            </button>
          </div>
          <p className="text-3 text-muted" style={{ margin: "12px 0 0", fontSize: "11px", color: "var(--text-3)", lineHeight: 1.6 }}>Desktop: usa "Escolher ficheiro". Mobile: "Tirar foto" abre a câmara traseira.</p>
        </div>
      )}

      {image && !showResults && (
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>
            <img src={image} alt="Talão carregado" style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)" }} />
          </div>
          <p className="text-3 text-muted" style={{ textAlign: "center", marginBottom: "var(--space-4)" }}>{ocrProgress}</p>
          <div className="flex-center" style={{ gap: "var(--space-3)" }}>
            <button className="btn btn-primary" onClick={runOCR} disabled={processing}>
              {processing ? (
                <> <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" strokeOpacity="0.2"/><path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"/></svg> A processar… </> ) : (
                <> <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Extrair texto (OCR) </> )}
            </button>
            <button className="btn btn-secondary" onClick={resetAll}>Cancelar</button>
          </div>
          {processing && <div className="flex-center" style={{ marginTop: "var(--space-3)" }}><span className="text-3 text-muted">{ocrProgress}</span></div>}
        </div>
      )}

      {showResults && parsedLines.length > 0 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
            <h2 className="title-3">{parsedLines.length} itens detectados — revê e confirma</h2>
            <span className="badge badge-info">Edita qualquer campo antes de importar</span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: "30%" }}>Ingrediente</th>
                  <th className="mono" style={{ width: "12%" }}>Qtd</th>
                  <th style={{ width: "12%" }}>Unidade</th>
                  <th className="mono" style={{ width: "12%" }}>Preço (€)</th>
                  <th style={{ width: "14%" }}>Promoção</th>
                  <th style={{ width: "10%" }}>Confiança</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {parsedLines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        className="input"
                        value={line.name}
                        onChange={e => updateLine(idx, "name", e.target.value)}
                        placeholder="Nome do ingrediente"
                      />
                    </td>
                    <td className="mono">
                      <input type="number" className="input input-num" min="0.01" step="0.01" value={line.quantity} onChange={e => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)} />
                    </td>
                    <td>
                      <select className="select" value={line.unit} onChange={e => updateLine(idx, "unit", e.target.value)}>
                        {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="mono">
                      <input type="number" className="input input-num" min="0" step="0.01" value={line.price} onChange={e => updateLine(idx, "price", parseFloat(e.target.value) || 0)} />
                    </td>
                    <td>
                      <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <input type="checkbox" checked={line.is_discount} onChange={e => updateLine(idx, "is_discount", e.target.checked)} />
                        {line.is_discount && (
                          <input type="number" className="input input-num" style={{ width: "60px" }} min="0" max="100" value={line.discount_percent} onChange={e => updateLine(idx, "discount_percent", parseInt(e.target.value) || 0)} placeholder="%" />
                        )}
                      </label>
                    </td>
                    <td className="mono">
                      <span className={line.confidence > 0.7 ? "badge badge-success" : line.confidence > 0.4 ? "badge badge-warn" : "badge badge-danger"}>
                        {Math.round(line.confidence * 100)}%
                      </span>
                    </td>
                    <td>
                      <button className="btn-icon danger" onClick={() => setParsedLines(l => l.filter((_, i) => i !== idx))} title="Remover" aria-label="Remover linha">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="field" style={{ marginTop: "var(--space-4)" }}>
            <label className="field-label" htmlFor="receipt-supplier">Fornecedor (opcional)</label>
            <select id="receipt-supplier" className="select" value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value ? parseInt(e.target.value) : "")}>
              <option value="">— Nenhum —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="flex-center" style={{ gap: "var(--space-3)", marginTop: "var(--space-6)" }}>
            <button className="btn btn-primary" onClick={confirmImport} disabled={processing} style={{ minWidth: "220px" }}>
              {processing ? "A importar…" : "Confirmar e importar para stock"}
            </button>
            <button className="btn btn-secondary" onClick={resetAll}>Cancelar e limpar</button>
          </div>
        </div>
      )}

      {showResults && parsedLines.length === 0 && image && (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <svg className="empty-icon" style={{ marginBottom: "var(--space-4)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <h2 className="empty-title">Nenhum item detectado</h2>
          <p className="empty-desc">O OCR não encontrou linhas com padrão preço/quantidade reconhecível. Tenta uma foto mais nítida ou edita manualmente.</p>
          <button className="btn btn-primary" onClick={resetAll} style={{ marginTop: "var(--space-4)" }}>Tentar outra imagem</button>
        </div>
      )}

    </div>
  );
}