import { useState, useRef, useEffect } from "react";
import { invoke } from "../lib/devInvoke";
import { useToast } from "../components/ui/Toast";
import { createWorker } from "tesseract.js";
import PageHeader from "../components/ui/PageHeader";
import { useI18n } from "../i18n";
import type { Ingredient } from "../../crates/core/bindings/Ingredient";
import type { Supplier } from "../../crates/core/bindings/Supplier";

// Forma solta de item ainda por confirmar (parsing de OCR heurístico) —
// sem binding correspondente, propositadamente fora do âmbito do i18n.
interface ParsedLine {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  is_discount: boolean;
  discount_percent: number;
  confidence: number;
  // Código de taxa de IVA impresso à frente do artigo (ex. "C", "E") e a
  // taxa correspondente, lida da tabela "Resumo IVA" do rodapé do talão —
  // ver secção 3.5 do PROJECT.md. null quando não detectado (talão sem
  // essa tabela, ou linha sem código legível).
  vat_code: string | null;
  vat_rate: number | null;
  include: boolean;
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

// Separa as linhas de artigos da tabela "Resumo IVA" do rodapé (ver
// PROJECT.md secção 3.5) e constrói o mapa letra → taxa%. Módulo, não
// componente: não depende de estado do React, exportada para o
// self-check em receipt_vat_parsing.check.mjs.
export function parseVatSummary(rawLines: string[]): { itemLines: string[]; vatMap: Record<string, number> } {
  const summaryIdx = rawLines.findIndex(l => /resumo\s*iva/i.test(l));
  if (summaryIdx === -1) return { itemLines: rawLines, vatMap: {} };
  const vatMap: Record<string, number> = {};
  const vatLineRegex = /^([A-Za-z])\s+(\d+)\s*%/;
  for (const l of rawLines.slice(summaryIdx + 1)) {
    const m = l.match(vatLineRegex);
    if (m) vatMap[m[1].toUpperCase()] = parseInt(m[2], 10);
  }
  return { itemLines: rawLines.slice(0, summaryIdx), vatMap };
}

export default function ReceiptScannerPage() {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [parsedLines, setParsedLines] = useState<ParsedLine[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<number | "">("");
  const [processing, setProcessing] = useState(false);
  const { t } = useI18n();
  const [ocrProgress, setOcrProgress] = useState<string>(t("receiptScanner.ocr.waitingImage"));
  const { showToast } = useToast();
  const [showResults, setShowResults] = useState(false);
  const [importSummary, setImportSummary] = useState<{ count: number; total: number } | null>(null);
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
      setOcrProgress(t("receiptScanner.ocr.modelReady"));
    } catch (e) {
      setOcrProgress(t("receiptScanner.ocr.modelError"));
      showToast(t("receiptScanner.ocr.initError"), "err");
    }
  };

  const loadIngredients = async () => {
    try {
      const data = await invoke<Ingredient[]>("ingredients_list");
      setIngredients(data);
    } catch { showToast(t("receiptScanner.loadIngredientsError"), "err"); }
  };

  const loadSuppliers = async () => {
    try {
      const data = await invoke<Supplier[]>("suppliers_list");
      setSuppliers(data);
    } catch { showToast(t("receiptScanner.loadSuppliersError"), "err"); }
  };

  const parseReceiptText = (text: string): ParsedLine[] => {
    const rawLines = text.split("\n").map(l => l.trim()).filter(l => l.length > 2);
    const { itemLines: lines, vatMap } = parseVatSummary(rawLines);
    const hasVatTable = Object.keys(vatMap).length > 0;
    const results: ParsedLine[] = [];

    const priceRegex = /(\d+[.,]\d{2})\s*[€$]?/g;
    const qtyUnitRegex = /(\d+[.,]?\d*)\s*(g|kg|ml|l|pcs|pc|un|unid|unidade|pack|pacote|bottle|garrafa|box|caixa|can|lata|jar|frasco|bag|saco|sachet|saqueta)/gi;

    for (const rawLine of lines) {
      // Código de taxa de IVA impresso à frente do artigo (ex. "E DR. BAYARD 200G").
      let vatCode: string | null = null;
      let line = rawLine.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "");
      const vatMatch = line.match(/^([A-Za-z])\s+(?=\S)/);
      if (vatMatch) {
        vatCode = vatMatch[1].toUpperCase();
        line = line.slice(vatMatch[0].length);
      }

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

      const vatRate = vatCode ? vatMap[vatCode] ?? null : null;
      // Sinal primário: taxa de IVA reduzida/intermédia (≤13%) sugere
      // alimentar, taxa normal (23%) sugere não-alimentar — nunca um filtro
      // rígido, só a pré-seleção por omissão (guardrail: PROJECT.md 3.5).
      // Sinal secundário: já ser um ingrediente conhecido vence sempre.
      const include = existingIng ? true : hasVatTable ? vatRate != null && vatRate <= 13 : true;

      results.push({
        name: existingIng?.name ?? name,
        quantity: qty,
        unit: existingIng?.unit ?? unit,
        price: lastPrice,
        is_discount: isDiscount,
        discount_percent: discountPercent,
        confidence: existingIng ? 0.9 : 0.5,
        vat_code: vatCode,
        vat_rate: vatRate,
        include,
      });
    }

    return results;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast(t("receiptScanner.selectImageFile"), "warn");
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
      showToast(t("receiptScanner.cameraError"), "err");
    }
  };

  const runOCR = async () => {
    if (!imageFile || !workerRef.current) return;
    setProcessing(true);
    setOcrProgress(t("receiptScanner.ocr.processing"));
    try {
      const { data: { text } } = await workerRef.current.recognize(imageFile);
      const parsed = parseReceiptText(text);
      setParsedLines(parsed);
      setShowResults(true);
      setOcrProgress(t("receiptScanner.ocr.linesDetected", { count: parsed.length }));
      showToast(t("receiptScanner.ocr.itemsExtracted", { count: parsed.length }), parsed.length > 0 ? "ok" : "warn");
    } catch (e) {
      showToast(t("receiptScanner.ocr.error"), "err");
      setOcrProgress(t("receiptScanner.ocr.error"));
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
    } catch { throw new Error(t("receiptScanner.createIngredientError", { name: line.name })); }
  };

  const confirmImport = async () => {
    const toImport = parsedLines.filter(l => l.include);
    if (toImport.length === 0) { showToast(t("receiptScanner.nothingToImport"), "warn"); return; }
    setProcessing(true);
    try {
      for (const line of toImport) {
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
            notes: t("receiptScanner.importedNote"),
          },
        });
      }
      showToast(t("receiptScanner.purchasesRegistered", { count: toImport.length }), "ok");
      setImportSummary({
        count: toImport.length,
        total: toImport.reduce((s, l) => s + l.quantity * l.price, 0),
      });
      setParsedLines([]);
      setShowResults(false);
      setImage(null);
      setImageFile(null);
    } catch (e) {
      showToast(t("receiptScanner.importError"), "err");
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
    setOcrProgress(t("receiptScanner.ocr.waitingImage"));
    setImportSummary(null);
  };

  const goBackToExtract = () => {
    setShowResults(false);
  };

  // Step index for the indicator bar: 0 upload, 1 extract, 2 review, 3 confirm.
  const currentStep = importSummary ? 3 : showResults ? 2 : image ? 1 : 0;
  const STEP_META = [
    { label: t("receiptScanner.steps.upload"), icon: "upload_file" },
    { label: t("receiptScanner.steps.extract"), icon: "document_scanner" },
    { label: t("receiptScanner.steps.review"), icon: "edit_note" },
    { label: t("receiptScanner.steps.confirm"), icon: "task_alt" },
  ];

  const matchMeta = (confidence: number): { color: string; icon: string; label: string } =>
    confidence > 0.7
      ? { color: "var(--green)", icon: "check_circle", label: t("receiptScanner.match.recognized") }
      : confidence > 0.4
      ? { color: "var(--amber)", icon: "add_circle", label: t("receiptScanner.match.newItem") }
      : { color: "var(--red)", icon: "help", label: t("receiptScanner.match.verify") };

  const includedLines = parsedLines.filter(l => l.include);
  const reviewTotal = includedLines.reduce((s, l) => s + l.quantity * l.price, 0);
  const reviewNewCount = parsedLines.filter(l => l.confidence <= 0.7).length;

  return (
    <div className="content">
      <PageHeader
        title={t("receiptScanner.title")}
        subtitle={t("receiptScanner.subtitle")}
        actions={
          <button className="btn" onClick={resetAll} disabled={!image && parsedLines.length === 0 && !importSummary}>
            <span className="ms" style={{ fontSize: 16 }} aria-hidden="true">refresh</span>
            {t("receiptScanner.newScan")}
          </button>
        }
      />

      {/* step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 13, padding: "14px 20px", marginBottom: 20 }}>
        {STEP_META.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, flex: i < STEP_META.length - 1 ? "0 0 auto" : "0 0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0,
                  background: i < currentStep ? "var(--green)" : i === currentStep ? "var(--ember)" : "var(--inset)",
                  color: i <= currentStep ? "#fff" : "var(--ink-3)",
                  border: i === currentStep || i < currentStep ? "none" : "1px solid var(--line)",
                }}
              >
                <span className="ms" style={{ fontSize: 17 }} aria-hidden="true">{s.icon}</span>
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: i <= currentStep ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < STEP_META.length - 1 && <div style={{ flex: 1, height: 1, background: "var(--line)", minWidth: 14 }} />}
          </div>
        ))}
      </div>

      {/* step 3: confirm — checked first, since after import image/showResults are already reset */}
      {importSummary ? (
        <div className="card" style={{ borderRadius: 16, padding: 48, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--green-soft)", display: "grid", placeItems: "center", margin: "0 auto" }}>
            <span className="ms" style={{ fontSize: 34, color: "var(--green)" }} aria-hidden="true">task_alt</span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--ink)", marginTop: 16 }}>{t("receiptScanner.confirmStep.title")}</div>
          <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 6 }}>{t("receiptScanner.confirmStep.subtitle", { count: importSummary.count })}</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
            <div style={{ background: "var(--inset)", borderRadius: 12, padding: "14px 22px" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "var(--ink-3)" }}>{t("receiptScanner.confirmStep.imported")}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>{importSummary.count}</div>
            </div>
            <div style={{ background: "var(--inset)", borderRadius: 12, padding: "14px 22px" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "var(--ink-3)" }}>{t("receiptScanner.confirmStep.spent")}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ember)", marginTop: 3 }}>{importSummary.total.toFixed(2)} €</div>
            </div>
            <div style={{ background: "var(--inset)", borderRadius: 12, padding: "14px 22px" }}>
              <div className="mono" style={{ fontSize: 9, textTransform: "uppercase", color: "var(--ink-3)" }}>{t("receiptScanner.confirmStep.stock")}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--green)", marginTop: 3 }}>✓</div>
            </div>
          </div>
          <button className="btn" onClick={resetAll} style={{ marginTop: 28 }}>{t("receiptScanner.confirmStep.scanAnother")}</button>
        </div>
      ) : !image && !showResults ? (
        /* step 0: upload */
        <div className="card" style={{ border: "2px dashed var(--line)", borderRadius: 16, padding: 56, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--ember-soft)", display: "grid", placeItems: "center", margin: "0 auto" }}>
            <span className="ms" style={{ fontSize: 32, color: "var(--ember)" }} aria-hidden="true">photo_camera</span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", marginTop: 18 }}>{t("receiptScanner.uploadStep.title")}</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, maxWidth: 380, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            {t("receiptScanner.uploadStep.desc")}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22 }}>
            <label className="btn-primary" style={{ cursor: "pointer" }}>
              <span className="ms" style={{ fontSize: 19 }} aria-hidden="true">upload</span>
              {t("receiptScanner.uploadStep.chooseFile")}
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />
            </label>
            <button className="btn-secondary" style={{ height: 42, padding: "0 20px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 }} onClick={handleCameraCapture}>
              <span className="ms" style={{ fontSize: 19 }} aria-hidden="true">photo_camera</span>
              {t("receiptScanner.uploadStep.useCamera")}
            </button>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: 11, color: "var(--ink-3)", lineHeight: 1.6 }}>{t("receiptScanner.uploadStep.hint")}</p>
        </div>
      ) : image && !showResults ? (
        /* step 1: extract */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 18 }}>
          <div style={{ border: "1px solid var(--line)", borderRadius: 14, minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: 14, position: "relative", background: "var(--inset)", overflow: "hidden" }}>
            <span className="mono" style={{ position: "absolute", top: 14, left: 14, fontSize: 10, color: "var(--ink-3)", background: "var(--surface)", padding: "3px 8px", borderRadius: 6, zIndex: 1 }}>
              {t("receiptScanner.extractStep.receiptLabel")} · {(imageFile?.name || "receipt.jpg").toUpperCase()}
            </span>
            <img src={image!} alt={t("receiptScanner.extractStep.altText")} style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 10, objectFit: "contain" }} />
          </div>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: processing ? "var(--ember)" : "var(--ink-2)" }}>
              <span className="ms" style={{ fontSize: 19 }} aria-hidden="true">{processing ? "hourglass_top" : "document_scanner"}</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{processing ? t("receiptScanner.extractStep.extracting") : t("receiptScanner.extractStep.readyToExtract")}</span>
            </div>
            <div className="mono" style={{ fontSize: 11.5, color: "var(--ink-2)", lineHeight: 1.9, marginTop: 14, background: "var(--inset)", borderRadius: 10, padding: 14 }}>
              {ocrProgress}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn" onClick={resetAll}>{t("common.cancel")}</button>
              <button className="btn-primary" onClick={runOCR} disabled={processing} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {processing ? (
                  <span className="ms animate-spin" style={{ fontSize: 18 }} aria-hidden="true">progress_activity</span>
                ) : (
                  <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">arrow_forward</span>
                )}
                {processing ? t("receiptScanner.extractStep.processingBtn") : t("receiptScanner.extractStep.extractBtn")}
              </button>
            </div>
          </div>
        </div>
      ) : showResults && parsedLines.length > 0 ? (
        /* step 2: review */
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, background: "var(--amber-soft)" }}>
            <span className="ms" style={{ fontSize: 19, color: "var(--amber)" }} aria-hidden="true">edit_note</span>
            <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, flex: 1 }}>{t("receiptScanner.reviewStep.confirmMsg")}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600 }}>{t("receiptScanner.reviewStep.toVerify", { count: reviewNewCount })}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "32px 1.7fr 90px 90px 100px 1fr 90px 36px", gap: 10, padding: "9px 18px", borderBottom: "1px solid var(--line)", background: "var(--inset)" }}>
            <span style={{ display: "flex", alignItems: "center" }}>
              <input
                type="checkbox"
                checked={parsedLines.length > 0 && includedLines.length === parsedLines.length}
                ref={el => { if (el) el.indeterminate = includedLines.length > 0 && includedLines.length < parsedLines.length; }}
                onChange={e => setParsedLines(ls => ls.map(l => ({ ...l, include: e.target.checked })))}
                aria-label={t("receiptScanner.reviewStep.selectAll")}
              />
            </span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>{t("receiptScanner.reviewStep.colName")}</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>{t("receiptScanner.reviewStep.colQty")}</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>{t("receiptScanner.reviewStep.colUnit")}</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)", textAlign: "right" }}>{t("receiptScanner.reviewStep.colPrice")}</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>{t("receiptScanner.reviewStep.colMatch")}</span>
            <span className="mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".5px", color: "var(--ink-3)" }}>{t("receiptScanner.reviewStep.colPromo")}</span>
            <span></span>
          </div>

          {parsedLines.map((line, idx) => {
            const m = matchMeta(line.confidence);
            return (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "32px 1.7fr 90px 90px 100px 1fr 90px 36px", gap: 10, padding: "9px 18px", borderBottom: "1px solid var(--line-2)", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={line.include}
                    onChange={e => updateLine(idx, "include", e.target.checked)}
                    aria-label={t("receiptScanner.reviewStep.includeLine")}
                  />
                </div>
                <div>
                <input
                  value={line.name}
                  onChange={e => updateLine(idx, "name", e.target.value)}
                  placeholder={t("receiptScanner.reviewStep.namePlaceholder")}
                  style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 34, padding: "0 10px", fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink)", width: "100%" }}
                />
                {line.vat_code && (
                  <div className="mono" style={{ fontSize: 9.5, marginTop: 3, color: line.vat_rate != null ? (line.vat_rate <= 13 ? "var(--green)" : "var(--ink-3)") : "var(--amber)" }}>
                    {line.vat_rate != null
                      ? t("receiptScanner.reviewStep.vatRate", { code: line.vat_code, rate: line.vat_rate })
                      : t("receiptScanner.reviewStep.vatUnknown", { code: line.vat_code })}
                  </div>
                )}
                </div>
                <input
                  type="number" min="0.01" step="0.01" value={line.quantity}
                  onChange={e => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)}
                  className="mono"
                  style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 34, padding: "0 8px", fontSize: 12.5, color: "var(--ink)", width: "100%" }}
                />
                <select
                  value={line.unit} onChange={e => updateLine(idx, "unit", e.target.value)}
                  className="mono"
                  style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 34, padding: "0 6px", fontSize: 11.5, color: "var(--ink)", width: "100%" }}
                >
                  {Object.entries(UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "flex-end" }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)" }}>€</span>
                  <input
                    type="number" min="0" step="0.01" value={line.price}
                    onChange={e => updateLine(idx, "price", parseFloat(e.target.value) || 0)}
                    className="mono"
                    style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 34, padding: "0 8px", fontSize: 12.5, color: "var(--ink)", width: 66, textAlign: "right" }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="ms" style={{ fontSize: 17, color: m.color }} aria-hidden="true">{m.icon}</span>
                  <span style={{ fontSize: 11.5, color: m.color, fontWeight: 500 }}>{m.label}</span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" checked={line.is_discount} onChange={e => updateLine(idx, "is_discount", e.target.checked)} />
                  {line.is_discount && (
                    <input
                      type="number" min="0" max="100" value={line.discount_percent}
                      onChange={e => updateLine(idx, "discount_percent", parseInt(e.target.value) || 0)}
                      placeholder="%"
                      className="mono"
                      style={{ border: "1px solid var(--line)", background: "var(--inset)", borderRadius: 7, height: 28, padding: "0 6px", fontSize: 11, color: "var(--ink)", width: 44 }}
                    />
                  )}
                </label>
                <button
                  onClick={() => setParsedLines(l => l.filter((_, i) => i !== idx))}
                  title={t("receiptScanner.reviewStep.remove")} aria-label={t("receiptScanner.reviewStep.removeLine")}
                  style={{ width: 30, height: 30, border: "none", background: "transparent", borderRadius: 7, cursor: "pointer", color: "var(--ink-3)", display: "grid", placeItems: "center" }}
                >
                  <span className="ms" style={{ fontSize: 18 }} aria-hidden="true">close</span>
                </button>
              </div>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--inset)", gap: 14, flexWrap: "wrap" }}>
            <button className="btn" onClick={goBackToExtract}>{t("receiptScanner.reviewStep.back")}</button>
            <div className="field" style={{ margin: 0, minWidth: 200 }}>
              <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value ? parseInt(e.target.value) : "")} style={{ height: 38 }}>
                <option value="">{t("receiptScanner.reviewStep.noSupplier")}</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{t("receiptScanner.reviewStep.summary", { count: includedLines.length, total: reviewTotal.toFixed(2) })}</span>
              <button className="btn-primary" onClick={confirmImport} disabled={processing} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="ms" style={{ fontSize: 17 }} aria-hidden="true">check</span>
                {processing ? t("receiptScanner.reviewStep.importing") : t("receiptScanner.reviewStep.importBtn")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* step 2 (empty result) */
        <div className="empty">
          <span className="ms" style={{ fontSize: 40, color: "var(--ink-3)" }} aria-hidden="true">search_off</span>
          <h2 className="empty-title">{t("receiptScanner.emptyStep.title")}</h2>
          <p style={{ color: "var(--ink-2)", fontSize: 13, maxWidth: 380 }}>{t("receiptScanner.emptyStep.desc")}</p>
          <button className="btn-primary" onClick={resetAll} style={{ marginTop: 8 }}>{t("receiptScanner.emptyStep.tryAnother")}</button>
        </div>
      )}
    </div>
  );
}