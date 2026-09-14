import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Laptop,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Trash2,
  TrendingDown,
  Truck,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
import { authenticatedFetch } from "../lib/auth-session";

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  value: number | string;
  status: string;

  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  serviceTag?: string | null;

  purchaseDate?: string | null;
  purchaseCost?: number | string | null;
  currentBookValue?: number | string | null;
  accumulatedDepreciation?: number | string | null;
  residualValue?: number | string | null;
  depreciationMethod?: string | null;
  usefulLife?: number | string | null;
  depreciationStartDate?: string | null;

  condition?: string | null;
  location?: string | null;
  vendor?: string | null;

  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  notes?: string | null;

  processor?: string | null;
  ram?: string | null;
  storage?: string | null;
  storageType?: string | null;
  operatingSystem?: string | null;
  osVersion?: string | null;
  macAddress?: string | null;
  hostname?: string | null;

  imei?: string | null;
  imei2?: string | null;
  phoneNumber?: string | null;
  simIccid?: string | null;
  carrier?: string | null;
  storageCapacity?: string | null;
  color?: string | null;
  enrollmentStatus?: string | null;
  mdmDeviceId?: string | null;

  registrationNumber?: string | null;
  vin?: string | null;
  chassisNumber?: string | null;
  engineNumber?: string | null;
  year?: number | null;
  vehicleType?: string | null;
  bodyType?: string | null;
  fuelType?: string | null;
  fuelCapacity?: number | string | null;
  transmission?: string | null;
  odometer?: number | string | null;
  engineHours?: number | string | null;

  insurancePolicyNumber?: string | null;
  insuranceExpiry?: string | null;
  registrationExpiry?: string | null;
  inspectionExpiry?: string | null;

  lastServiceDate?: string | null;
  nextServiceDate?: string | null;
  maintenanceNotes?: string | null;

  createdAt: string;
  updatedAt?: string | null;
}

interface AssetResponse {
  success: boolean;
  asset?: Asset;
  message?: string;
}

interface AssetsResponse {
  success: boolean;
  assets?: Asset[];
  message?: string;
}

interface AssetForm {
  name: string;
  category: string;
  value: string;
  status: string;

  manufacturer: string;
  model: string;
  serialNumber: string;
  serviceTag: string;

  purchaseDate: string;
  purchaseCost: string;
  currentBookValue: string;
  accumulatedDepreciation: string;
  residualValue: string;
  depreciationMethod: string;
  usefulLife: string;
  depreciationStartDate: string;

  condition: string;
  location: string;
  vendor: string;

  warrantyStart: string;
  warrantyEnd: string;
  notes: string;

  processor: string;
  ram: string;
  storage: string;
  storageType: string;
  operatingSystem: string;
  osVersion: string;
  macAddress: string;
  hostname: string;

  imei: string;
  imei2: string;
  phoneNumber: string;
  simIccid: string;
  carrier: string;
  storageCapacity: string;
  color: string;
  enrollmentStatus: string;
  mdmDeviceId: string;

  registrationNumber: string;
  vin: string;
  chassisNumber: string;
  engineNumber: string;
  year: string;
  vehicleType: string;
  bodyType: string;
  fuelType: string;
  fuelCapacity: string;
  transmission: string;
  odometer: string;
  engineHours: string;

  insurancePolicyNumber: string;
  insuranceExpiry: string;
  registrationExpiry: string;
  inspectionExpiry: string;

  lastServiceDate: string;
  nextServiceDate: string;
  maintenanceNotes: string;
}

const emptyForm: AssetForm = {
  name: "",
  category: "",
  value: "",
  status: "ACTIVE",

  manufacturer: "",
  model: "",
  serialNumber: "",
  serviceTag: "",

  purchaseDate: "",
  purchaseCost: "",
  currentBookValue: "",
  accumulatedDepreciation: "",
  residualValue: "",
  depreciationMethod: "",
  usefulLife: "",
  depreciationStartDate: "",

  condition: "",
  location: "",
  vendor: "",

  warrantyStart: "",
  warrantyEnd: "",
  notes: "",

  processor: "",
  ram: "",
  storage: "",
  storageType: "",
  operatingSystem: "",
  osVersion: "",
  macAddress: "",
  hostname: "",

  imei: "",
  imei2: "",
  phoneNumber: "",
  simIccid: "",
  carrier: "",
  storageCapacity: "",
  color: "",
  enrollmentStatus: "",
  mdmDeviceId: "",

  registrationNumber: "",
  vin: "",
  chassisNumber: "",
  engineNumber: "",
  year: "",
  vehicleType: "",
  bodyType: "",
  fuelType: "",
  fuelCapacity: "",
  transmission: "",
  odometer: "",
  engineHours: "",

  insurancePolicyNumber: "",
  insuranceExpiry: "",
  registrationExpiry: "",
  inspectionExpiry: "",

  lastServiceDate: "",
  nextServiceDate: "",
  maintenanceNotes: "",
};

const inputClass =
  "w-full rounded-xl border border-[#DCDDEA] bg-white px-3.5 py-3 text-sm text-[#20243A] outline-none transition placeholder:text-[#9A9EB0] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10";

const selectClass =
  "w-full rounded-xl border border-[#DCDDEA] bg-white px-3.5 py-3 text-sm text-[#20243A] outline-none transition focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/10";

const labelClass =
  "mb-2 block text-sm font-medium text-[#20243A]";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function dateInputValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function formatCurrency(value: number | string | null | undefined): string {
  const amount =
    typeof value === "number"
      ? value
      : Number(String(value ?? "0").replace(/,/g, ""));

  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "â€”";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

function isComputerCategory(category: string): boolean {
  return [
    "computer",
    "computers",
    "laptop",
    "laptops",
    "desktop",
    "desktop computer",
    "workstation",
    "macbook",
  ].includes(normalizeCategory(category));
}

function isMobileCategory(category: string): boolean {
  return [
    "mobile",
    "mobile phone",
    "phone",
    "phones",
    "smartphone",
    "tablet",
    "tablets",
    "ipad",
    "iphone",
    "android",
  ].includes(normalizeCategory(category));
}

function isVehicleCategory(category: string): boolean {
  return [
    "vehicle",
    "vehicles",
    "car",
    "cars",
    "motor vehicle",
    "motorcycle",
    "motorcycles",
    "truck",
    "trucks",
    "van",
    "vans",
    "boda boda",
    "tuk tuk",
    "tuk-tuk",
  ].includes(normalizeCategory(category));
}

function categoryIcon(category: string) {
  if (isComputerCategory(category)) {
    return <Laptop size={20} />;
  }

  if (isMobileCategory(category)) {
    return <Smartphone size={20} />;
  }

  if (isVehicleCategory(category)) {
    return <Truck size={20} />;
  }

  return <FileText size={20} />;
}

function categoryBadgeClass(category: string): string {
  if (isComputerCategory(category)) {
    return "bg-blue-50 text-blue-700";
  }

  if (isMobileCategory(category)) {
    return "bg-violet-50 text-violet-700";
  }

  if (isVehicleCategory(category)) {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-50 text-slate-700";
}

function statusBadgeClass(status: string): string {
  const normalized = status.toUpperCase();

  if (normalized === "ACTIVE") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (normalized === "ASSIGNED") {
    return "bg-blue-50 text-blue-700";
  }

  if (normalized === "INACTIVE") {
    return "bg-slate-100 text-slate-600";
  }

  if (normalized === "DISPOSED") {
    return "bg-red-50 text-red-700";
  }

  if (normalized === "UNDER_MAINTENANCE") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-50 text-slate-600";
}

function formFromAsset(asset: Asset): AssetForm {
  return {
    name: stringValue(asset.name),
    category: stringValue(asset.category),
    value: numberValue(asset.value),
    status: stringValue(asset.status),

    manufacturer: stringValue(asset.manufacturer),
    model: stringValue(asset.model),
    serialNumber: stringValue(asset.serialNumber),
    serviceTag: stringValue(asset.serviceTag),

    purchaseDate: dateInputValue(asset.purchaseDate),
    purchaseCost: numberValue(asset.purchaseCost),
    currentBookValue: numberValue(asset.currentBookValue),
    accumulatedDepreciation: numberValue(asset.accumulatedDepreciation),
    residualValue: numberValue(asset.residualValue),
    depreciationMethod: stringValue(asset.depreciationMethod),
    usefulLife: numberValue(asset.usefulLife),
    depreciationStartDate: dateInputValue(asset.depreciationStartDate),

    condition: stringValue(asset.condition),
    location: stringValue(asset.location),
    vendor: stringValue(asset.vendor),

    warrantyStart: dateInputValue(asset.warrantyStart),
    warrantyEnd: dateInputValue(asset.warrantyEnd),
    notes: stringValue(asset.notes),

    processor: stringValue(asset.processor),
    ram: stringValue(asset.ram),
    storage: stringValue(asset.storage),
    storageType: stringValue(asset.storageType),
    operatingSystem: stringValue(asset.operatingSystem),
    osVersion: stringValue(asset.osVersion),
    macAddress: stringValue(asset.macAddress),
    hostname: stringValue(asset.hostname),

    imei: stringValue(asset.imei),
    imei2: stringValue(asset.imei2),
    phoneNumber: stringValue(asset.phoneNumber),
    simIccid: stringValue(asset.simIccid),
    carrier: stringValue(asset.carrier),
    storageCapacity: stringValue(asset.storageCapacity),
    color: stringValue(asset.color),
    enrollmentStatus: stringValue(asset.enrollmentStatus),
    mdmDeviceId: stringValue(asset.mdmDeviceId),

    registrationNumber: stringValue(asset.registrationNumber),
    vin: stringValue(asset.vin),
    chassisNumber: stringValue(asset.chassisNumber),
    engineNumber: stringValue(asset.engineNumber),
    year: numberValue(asset.year),
    vehicleType: stringValue(asset.vehicleType),
    bodyType: stringValue(asset.bodyType),
    fuelType: stringValue(asset.fuelType),
    fuelCapacity: numberValue(asset.fuelCapacity),
    transmission: stringValue(asset.transmission),
    odometer: numberValue(asset.odometer),
    engineHours: numberValue(asset.engineHours),

    insurancePolicyNumber: stringValue(asset.insurancePolicyNumber),
    insuranceExpiry: dateInputValue(asset.insuranceExpiry),
    registrationExpiry: dateInputValue(asset.registrationExpiry),
    inspectionExpiry: dateInputValue(asset.inspectionExpiry),

    lastServiceDate: dateInputValue(asset.lastServiceDate),
    nextServiceDate: dateInputValue(asset.nextServiceDate),
    maintenanceNotes: stringValue(asset.maintenanceNotes),
  };
}

function buildPayload(form: AssetForm) {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    category: form.category.trim(),
    value: Number(form.value || 0),
    status: form.status,

    manufacturer: form.manufacturer.trim() || null,
    model: form.model.trim() || null,
    serialNumber: form.serialNumber.trim() || null,
    serviceTag: form.serviceTag.trim() || null,

    purchaseDate: form.purchaseDate || null,
    purchaseCost:
      form.purchaseCost.trim() === ""
        ? null
        : Number(form.purchaseCost),
    currentBookValue:
      form.currentBookValue.trim() === ""
        ? null
        : Number(form.currentBookValue),

    accumulatedDepreciation:
      form.accumulatedDepreciation.trim() === ""
        ? null
        : Number(form.accumulatedDepreciation),
    residualValue:
      form.residualValue.trim() === ""
        ? null
        : Number(form.residualValue),
    depreciationMethod:
      form.depreciationMethod.trim() || null,
    usefulLife:
      form.usefulLife.trim() === ""
        ? null
        : Number(form.usefulLife),
    depreciationStartDate:
      form.depreciationStartDate || null,

    condition: form.condition.trim() || null,
    location: form.location.trim() || null,
    vendor: form.vendor.trim() || null,

    warrantyStart: form.warrantyStart || null,
    warrantyEnd: form.warrantyEnd || null,
    notes: form.notes.trim() || null,

    processor: form.processor.trim() || null,
    ram: form.ram.trim() || null,
    storage: form.storage.trim() || null,
    storageType: form.storageType.trim() || null,
    operatingSystem: form.operatingSystem.trim() || null,
    osVersion: form.osVersion.trim() || null,
    macAddress: form.macAddress.trim() || null,
    hostname: form.hostname.trim() || null,

    imei: form.imei.trim() || null,
    imei2: form.imei2.trim() || null,
    phoneNumber: form.phoneNumber.trim() || null,
    simIccid: form.simIccid.trim() || null,
    carrier: form.carrier.trim() || null,
    storageCapacity: form.storageCapacity.trim() || null,
    color: form.color.trim() || null,
    enrollmentStatus: form.enrollmentStatus.trim() || null,
    mdmDeviceId: form.mdmDeviceId.trim() || null,

    registrationNumber:
      form.registrationNumber.trim() || null,
    vin: form.vin.trim() || null,
    chassisNumber:
      form.chassisNumber.trim() || null,
    engineNumber:
      form.engineNumber.trim() || null,
    year:
      form.year.trim() === ""
        ? null
        : Number(form.year),
    vehicleType: form.vehicleType.trim() || null,
    bodyType: form.bodyType.trim() || null,
    fuelType: form.fuelType.trim() || null,
    fuelCapacity:
      form.fuelCapacity.trim() === ""
        ? null
        : Number(form.fuelCapacity),
    transmission:
      form.transmission.trim() || null,
    odometer:
      form.odometer.trim() === ""
        ? null
        : Number(form.odometer),
    engineHours:
      form.engineHours.trim() === ""
        ? null
        : Number(form.engineHours),

    insurancePolicyNumber:
      form.insurancePolicyNumber.trim() || null,
    insuranceExpiry:
      form.insuranceExpiry || null,
    registrationExpiry:
      form.registrationExpiry || null,
    inspectionExpiry:
      form.inspectionExpiry || null,

    lastServiceDate:
      form.lastServiceDate || null,
    nextServiceDate:
      form.nextServiceDate || null,
    maintenanceNotes:
      form.maintenanceNotes.trim() || null,
  };

  return payload;
}

function validateForm(form: AssetForm): string | null {
  if (!form.name.trim()) {
    return "Asset name is required.";
  }

  if (!form.category.trim()) {
    return "Asset category is required.";
  }

  const value = Number(form.value);

  if (!Number.isFinite(value) || value < 0) {
    return "Asset value must be a valid non-negative amount.";
  }

  if (form.purchaseCost.trim() !== "") {
    const purchaseCost = Number(form.purchaseCost);

    if (!Number.isFinite(purchaseCost) || purchaseCost < 0) {
      return "Purchase cost must be a valid non-negative amount.";
    }
  }

  if (form.currentBookValue.trim() !== "") {
    const bookValue = Number(form.currentBookValue);

    if (!Number.isFinite(bookValue) || bookValue < 0) {
      return "Current book value must be a valid non-negative amount.";
    }
  }

  if (form.accumulatedDepreciation.trim() !== "") {
    const accumulatedDepreciation = Number(form.accumulatedDepreciation);
    if (!Number.isFinite(accumulatedDepreciation) || accumulatedDepreciation < 0) {
      return "Accumulated depreciation must be a valid non-negative amount.";
    }
  }

  if (form.residualValue.trim() !== "") {
    const residualValue = Number(form.residualValue);
    if (!Number.isFinite(residualValue) || residualValue < 0) {
      return "Residual value must be a valid non-negative amount.";
    }
  }

  if (form.usefulLife.trim() !== "") {
    const usefulLife = Number(form.usefulLife);
    if (!Number.isInteger(usefulLife) || usefulLife <= 0) {
      return "Useful life must be a positive whole number.";
    }
  }

  if (
    isComputerCategory(form.category) &&
    !form.serialNumber.trim()
  ) {
    return "Serial number is required for computer and laptop assets.";
  }

  if (isVehicleCategory(form.category) && form.year.trim()) {
    const year = Number(form.year);

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > new Date().getFullYear() + 1
    ) {
      return "Vehicle year is invalid.";
    }
  }

  return null;
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </span>
      {children}
    </label>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF7F5] text-[#0D9488]">
        {icon}
      </div>

      <div>
        <h3 className="font-semibold text-[#20243A]">
          {title}
        </h3>

        <p className="mt-0.5 text-xs text-[#777C92]">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editingSaving, setEditingSaving] =
    useState(false);

  const [deletingAssetId, setDeletingAssetId] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("");

  const [conditionFilter, setConditionFilter] =
    useState("");

  const [error, setError] =
    useState("");

  const [formError, setFormError] =
    useState("");

  const [editError, setEditError] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [viewingAsset, setViewingAsset] =
    useState<Asset | null>(null);

  const [editingAsset, setEditingAsset] =
    useState<Asset | null>(null);

  const [form, setForm] =
    useState<AssetForm>(emptyForm);

  const [editForm, setEditForm] =
    useState<AssetForm>(emptyForm);

  const updateForm = (
    field: keyof AssetForm,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateEditForm = (
    field: keyof AssetForm,
    value: string
  ) => {
    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const loadAssets = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (categoryFilter) {
        params.set("category", categoryFilter);
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (conditionFilter) {
        params.set("condition", conditionFilter);
      }

      const query = params.toString()
        ? `?${params.toString()}`
        : "";

      const response =
        await authenticatedFetch(
          `/api/assets${query}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

      const data =
        (await response.json().catch(() => null)) as
          | AssetsResponse
          | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to load assets (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to load assets."
        );
      }

      setAssets(data.assets ?? []);
    } catch (err) {
      setAssets([]);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load assets."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void loadAssets();
      },
      search.trim() ? 300 : 0
    );

    return () =>
      window.clearTimeout(timer);
  }, [
    search,
    categoryFilter,
    statusFilter,
    conditionFilter,
  ]);

  const totalCost = useMemo(
    () =>
      assets.reduce(
        (total, asset) =>
          total +
          Number(
            asset.purchaseCost ??
              asset.value ??
              0
          ),
        0
      ),
    [assets]
  );

  const totalBookValue = useMemo(
    () =>
      assets.reduce(
        (total, asset) =>
          total +
          Number(
            asset.currentBookValue ??
              asset.purchaseCost ??
              asset.value ??
              0
          ),
        0
      ),
    [assets]
  );

  const totalAccumulatedDepreciation = useMemo(
    () =>
      assets.reduce(
        (total, asset) =>
          total + Number(asset.accumulatedDepreciation ?? 0),
        0
      ),
    [assets]
  );

  const activeCount = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.status.toUpperCase() ===
          "ACTIVE"
      ).length,
    [assets]
  );

  const disposedCount = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.status.toUpperCase() ===
          "DISPOSED"
      ).length,
    [assets]
  );

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        assets
          .map((asset) => asset.category)
          .filter(Boolean)
      )
    ).sort();
  }, [assets]);

  const conditions = useMemo(() => {
    return Array.from(
      new Set(
        assets
          .map((asset) => asset.condition)
          .filter(
            (condition): condition is string =>
              Boolean(condition)
          )
      )
    ).sort();
  }, [assets]);

  const openAddModal = () => {
    setForm(emptyForm);
    setFormError("");
    setActionError("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (saving) {
      return;
    }

    setShowAddModal(false);
    setForm(emptyForm);
    setFormError("");
  };

  const submitAsset = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setFormError("");

    const validationError =
      validateForm(form);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSaving(true);

      const response =
        await authenticatedFetch(
          "/api/assets",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(
              buildPayload(form)
            ),
          }
        );

      const data =
        (await response.json().catch(() => null)) as
          | AssetResponse
          | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to create asset (${response.status}).`
        );
      }

      if (!data?.success || !data.asset) {
        throw new Error(
          data?.message ||
            "Failed to create asset."
        );
      }

      closeAddModal();

      await loadAssets();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Failed to create asset."
      );
    } finally {
      setSaving(false);
    }
  };

  const viewAsset = async (
    asset: Asset
  ) => {
    try {
      setActionError("");

      const response =
        await authenticatedFetch(
          `/api/assets/${asset.id}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          }
        );

      const data =
        (await response.json().catch(() => null)) as
          | AssetResponse
          | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to load asset (${response.status}).`
        );
      }

      if (!data?.success || !data.asset) {
        throw new Error(
          data?.message ||
            "Failed to load asset."
        );
      }

      setViewingAsset(data.asset);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to load asset."
      );
    }
  };

  const openEditModal = (
    asset: Asset
  ) => {
    setEditError("");
    setActionError("");
    setEditForm(formFromAsset(asset));
    setEditingAsset(asset);
  };

  const closeEditModal = () => {
    if (editingSaving) {
      return;
    }

    setEditingAsset(null);
    setEditForm(emptyForm);
    setEditError("");
  };

  const submitEdit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!editingAsset) {
      return;
    }

    setEditError("");

    const validationError =
      validateForm(editForm);

    if (validationError) {
      setEditError(validationError);
      return;
    }

    try {
      setEditingSaving(true);

      const response =
        await authenticatedFetch(
          `/api/assets/${editingAsset.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(
              buildPayload(editForm)
            ),
          }
        );

      const data =
        (await response.json().catch(() => null)) as
          | AssetResponse
          | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to update asset (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to update asset."
        );
      }

      closeEditModal();

      await loadAssets();
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : "Failed to update asset."
      );
    } finally {
      setEditingSaving(false);
    }
  };

  const deleteAsset = async (
    asset: Asset
  ) => {
    const confirmed =
      window.confirm(
        `Delete ${asset.name} (${asset.assetCode})? This action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingAssetId(asset.id);
      setActionError("");

      const response =
        await authenticatedFetch(
          `/api/assets/${asset.id}`,
          {
            method: "DELETE",
            headers: {
              Accept: "application/json",
            },
          }
        );

      const data =
        (await response.json().catch(() => null)) as
          | {
              success?: boolean;
              message?: string;
            }
          | null;

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to delete asset (${response.status}).`
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Failed to delete asset."
        );
      }

      setViewingAsset(null);

      await loadAssets();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to delete asset."
      );
    } finally {
      setDeletingAssetId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF7F5] text-[#0D9488]">
              <FileText size={23} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#20243A]">
                Fixed Assets
              </h1>

              <p className="mt-1 text-sm text-[#666B84]">
                Manage, track and maintain your organization's
                fixed asset register.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#0D9488] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F766E]"
        >
          <Plus size={18} />
          Add Fixed Asset
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Total Assets
              </p>

              <p className="mt-2 text-2xl font-bold text-[#20243A]">
                
              <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4F5F8]">
                    <TrendingDown size={18} className="text-[#777C92]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#777C92]">
                      Accumulated Depreciation
                    </p>
                    <p className="mt-2 text-2xl font-bold text-[#20243A]">
                      {loading
                        ? "—"
                        : formatCurrency(totalAccumulatedDepreciation)}
                    </p>
                    <p className="mt-1 text-xs text-[#8A8EA2]">
                      Depreciation recognized to date
                    </p>
                  </div>
                </div>
              </div>{loading ? "â€”" : assets.length}
              </p>

              <p className="mt-1 text-xs text-[#8A8EA2]">
                Assets in register
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <FileText size={19} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Total Cost
              </p>

              <p className="mt-2 text-2xl font-bold text-[#20243A]">
                {loading
                  ? "â€”"
                  : formatCurrency(totalCost)}
              </p>

              <p className="mt-1 text-xs text-[#8A8EA2]">
                Original acquisition cost
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <FileText size={19} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Current Book Value
              </p>

              <p className="mt-2 text-2xl font-bold text-[#20243A]">
                {loading
                  ? "â€”"
                  : formatCurrency(totalBookValue)}
              </p>

              <p className="mt-1 text-xs text-[#8A8EA2]">
                Current carrying value
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={19} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[#666B84]">
                Active Assets
              </p>

              <p className="mt-2 text-2xl font-bold text-[#20243A]">
                {loading ? "â€”" : activeCount}
              </p>

              <p className="mt-1 text-xs text-[#8A8EA2]">
                {disposedCount} disposed
              </p>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <CheckCircle2 size={19} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[#ECECF3] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-[#DCDDEA] bg-[#FBFCFE] px-3">
            <Search
              size={18}
              className="shrink-0 text-[#777C92]"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by asset name, code, serial number, model, location..."
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[#20243A] outline-none placeholder:text-[#9A9EB0]"
            />

            {loading && (
              <Loader2
                size={18}
                className="animate-spin text-[#777C92]"
              />
            )}
          </div>

          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value)
            }
            className="w-full rounded-xl border border-[#DCDDEA] bg-white px-3 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] xl:w-48"
          >
            <option value="">
              All Categories
            </option>

            {categories.map((category) => (
              <option
                key={category}
                value={category}
              >
                {category}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
            className="w-full rounded-xl border border-[#DCDDEA] bg-white px-3 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] xl:w-44"
          >
            <option value="">
              All Statuses
            </option>
            <option value="ACTIVE">
              Active
            </option>
            <option value="ASSIGNED">
              Assigned
            </option>
            <option value="INACTIVE">
              Inactive
            </option>
            <option value="UNDER_MAINTENANCE">
              Under Maintenance
            </option>
            <option value="DISPOSED">
              Disposed
            </option>
          </select>

          <select
            value={conditionFilter}
            onChange={(event) =>
              setConditionFilter(event.target.value)
            }
            className="w-full rounded-xl border border-[#DCDDEA] bg-white px-3 py-3 text-sm text-[#20243A] outline-none focus:border-[#0D9488] xl:w-44"
          >
            <option value="">
              All Conditions
            </option>

            {conditions.map((condition) => (
              <option
                key={condition}
                value={condition}
              >
                {condition}
              </option>
            ))}
          </select>
        </div>
      </div>

      {actionError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>
              <p className="font-semibold text-red-700">
                Asset action failed
              </p>

              <p className="mt-1 text-sm text-red-600">
                {actionError}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>
              <p className="font-semibold text-red-700">
                Unable to load fixed assets
              </p>

              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void loadAssets()}
                className="mt-3 text-sm font-semibold text-red-700 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Register */}
      {!error && (
        <div className="overflow-hidden rounded-2xl border border-[#ECECF3] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#ECECF3] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-[#20243A]">
                Asset Register
              </h2>

              <p className="mt-0.5 text-xs text-[#777C92]">
                Complete list of fixed assets owned or controlled by the organization.
              </p>
            </div>

            <div className="text-sm text-[#666B84]">
              {loading
                ? "Loading..."
                : `${assets.length} asset${assets.length === 1 ? "" : "s"}`}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[24rem] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-[#666B84]">
                <Loader2
                  size={22}
                  className="animate-spin"
                />
                Loading fixed assets...
              </div>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex min-h-[24rem] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF7F5] text-[#0D9488]">
                <FileText size={25} />
              </div>

              <h3 className="mt-4 font-semibold text-[#20243A]">
                No fixed assets found
              </h3>

              <p className="mt-1 max-w-md text-sm text-[#777C92]">
                {search ||
                categoryFilter ||
                statusFilter ||
                conditionFilter
                  ? "Try changing your search or filters."
                  : "Start building your organization's fixed asset register by adding your first asset."}
              </p>

              {!search &&
                !categoryFilter &&
                !statusFilter &&
                !conditionFilter && (
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="mt-5 flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <Plus size={17} />
                    Add Fixed Asset
                  </button>
                )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-[#F8F9FC]">
                  <tr className="border-b border-[#ECECF3]">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#777C92]">
                      Asset
                    </th>

                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#777C92]">
                      Category
                    </th>

                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#777C92]">
                      Identifier
                    </th>

                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#777C92]">
                      Location
                    </th>

                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[#777C92]">
                      Book Value
                    </th>

                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[#777C92]">
                      Status
                    </th>

                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-[#777C92]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      className="border-b border-[#F0F0F5] transition last:border-b-0 hover:bg-[#FBFCFE]"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${categoryBadgeClass(
                              asset.category
                            )}`}
                          >
                            {categoryIcon(
                              asset.category
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#20243A]">
                              {asset.name}
                            </p>

                            <p className="mt-0.5 text-xs font-medium text-[#0D9488]">
                              {asset.assetCode}
                            </p>

                            {(asset.manufacturer ||
                              asset.model) && (
                              <p className="mt-0.5 max-w-[240px] truncate text-xs text-[#777C92]">
                                {[
                                  asset.manufacturer,
                                  asset.model,
                                ]
                                  .filter(Boolean)
                                  .join(" Â· ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${categoryBadgeClass(
                            asset.category
                          )}`}
                        >
                          {asset.category}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm text-[#20243A]">
                          {asset.serialNumber ||
                            asset.registrationNumber ||
                            asset.imei ||
                            "â€”"}
                        </div>

                        {asset.serialNumber &&
                          asset.imei && (
                            <p className="mt-0.5 text-xs text-[#777C92]">
                              IMEI: {asset.imei}
                            </p>
                          )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex max-w-[170px] items-center gap-1.5 text-sm text-[#555A70]">
                          <MapPin
                            size={15}
                            className="shrink-0 text-[#8A8EA2]"
                          />

                          <span className="truncate">
                            {asset.location || "Not specified"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <p className="font-semibold text-[#20243A]">
                          {formatCurrency(
                            asset.currentBookValue ??
                              asset.purchaseCost ??
                              asset.value
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-[#8A8EA2]">
                          Cost{" "}
                          {formatCurrency(
                            asset.purchaseCost ??
                              asset.value
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                            asset.status
                          )}`}
                        >
                          {statusLabel(
                            asset.status
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void viewAsset(asset)
                            }
                            className="rounded-xl border border-[#DCDDEA] p-2.5 text-[#555A70] transition hover:border-[#0D9488] hover:bg-[#EAF7F5] hover:text-[#0D9488]"
                            title="View asset"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(asset)
                            }
                            className="rounded-xl border border-[#DCDDEA] p-2.5 text-[#555A70] transition hover:border-[#0D9488] hover:bg-[#EAF7F5] hover:text-[#0D9488]"
                            title="Edit asset"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            disabled={
                              deletingAssetId ===
                              asset.id
                            }
                            onClick={() =>
                              void deleteAsset(asset)
                            }
                            className="rounded-xl border border-red-200 p-2.5 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete asset"
                          >
                            {deletingAssetId ===
                            asset.id ? (
                              <Loader2
                                size={16}
                                className="animate-spin"
                              />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-[#20243A]">
                  Add Fixed Asset
                </h2>

                <p className="mt-1 text-sm text-[#777C92]">
                  Record a new asset in the organization's fixed asset register.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddModal}
                disabled={saving}
                className="rounded-xl p-2 text-[#777C92] transition hover:bg-[#F8F9FC] hover:text-[#20243A]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={submitAsset}
              className="min-h-0 overflow-y-auto"
            >
              <div className="space-y-7 p-6">
                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                {/* Automatic Asset Code */}
                <div className="rounded-2xl border border-[#BCE7E1] bg-[#F1FBF9] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#0D9488] shadow-sm">
                      <CheckCircle2 size={19} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-[#20243A]">
                        Asset Code generated automatically
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#666B84]">
                        The system will generate the next unique
                        asset code when you save this record.
                        You do not need to enter an asset code manually.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Basic Information */}
                <section>
                  <SectionHeader
                    icon={<FileText size={18} />}
                    title="Basic Information"
                    description="Core information used to identify and classify the asset."
                  />

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field
                      label="Asset Name"
                      required
                    >
                      <input
                        value={form.name}
                        onChange={(event) =>
                          updateForm(
                            "name",
                            event.target.value
                          )
                        }
                        placeholder="e.g. HP EliteBook X"
                        required
                        className={inputClass}
                      />
                    </Field>

                    <Field
                      label="Category"
                      required
                    >
                      <select
                        value={form.category}
                        onChange={(event) =>
                          updateForm(
                            "category",
                            event.target.value
                          )
                        }
                        required
                        className={selectClass}
                      >
                        <option value="">
                          Select category
                        </option>
                        <option value="Computer">
                          Computer
                        </option>
                        <option value="Laptop">
                          Laptop
                        </option>
                        <option value="Mobile Phone">
                          Mobile Phone
                        </option>
                        <option value="Tablet">
                          Tablet
                        </option>
                        <option value="Vehicle">
                          Vehicle
                        </option>
                        <option value="Furniture">
                          Furniture
                        </option>
                        <option value="Equipment">
                          Equipment
                        </option>
                        <option value="Office Equipment">
                          Office Equipment
                        </option>
                        <option value="Machinery">
                          Machinery
                        </option>
                        <option value="Other">
                          Other
                        </option>
                      </select>
                    </Field>

                    <Field label="Manufacturer / Make">
                      <input
                        value={form.manufacturer}
                        onChange={(event) =>
                          updateForm(
                            "manufacturer",
                            event.target.value
                          )
                        }
                        placeholder="e.g. HP, Toyota, Apple"
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Model">
                      <input
                        value={form.model}
                        onChange={(event) =>
                          updateForm(
                            "model",
                            event.target.value
                          )
                        }
                        placeholder="e.g. EliteBook 840 G11"
                        className={inputClass}
                      />
                    </Field>

                    <Field
                      label="Serial Number"
                      required={isComputerCategory(
                        form.category
                      )}
                    >
                      <input
                        value={form.serialNumber}
                        onChange={(event) =>
                          updateForm(
                            "serialNumber",
                            event.target.value
                          )
                        }
                        placeholder={
                          isComputerCategory(
                            form.category
                          )
                            ? "Required for computers and laptops"
                            : "Enter serial number if applicable"
                        }
                        required={isComputerCategory(
                          form.category
                        )}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Service Tag / Product Number">
                      <input
                        value={form.serviceTag}
                        onChange={(event) =>
                          updateForm(
                            "serviceTag",
                            event.target.value
                          )
                        }
                        placeholder="Optional manufacturer service tag"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </section>

                {/* Financial */}
                <section className="border-t border-[#ECECF3] pt-7">
                  <SectionHeader
                    icon={<FileText size={18} />}
                    title="Financial Information"
                    description="Acquisition cost, depreciation and current accounting value."
                  />

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <Field label="Purchase Date">
                      <input type="date" value={form.purchaseDate} onChange={(event) => updateForm("purchaseDate", event.target.value)} className={inputClass} />
                    </Field>

                    <Field label="Purchase Cost">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#777C92]">KES</span>
                        <input type="number" min="0" step="0.01" value={form.purchaseCost} onChange={(event) => updateForm("purchaseCost", event.target.value)} placeholder="0.00" className={`${inputClass} pl-14`} />
                      </div>
                    </Field>

                    <Field label="Current Book Value">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#777C92]">KES</span>
                        <input type="number" min="0" step="0.01" value={form.currentBookValue} onChange={(event) => updateForm("currentBookValue", event.target.value)} placeholder="0.00" className={`${inputClass} pl-14`} />
                      </div>
                    </Field>

                    <Field label="Asset Value" required>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#777C92]">KES</span>
                        <input type="number" min="0" step="0.01" value={form.value} onChange={(event) => updateForm("value", event.target.value)} placeholder="0.00" required className={`${inputClass} pl-14`} />
                      </div>
                    </Field>

                    <Field label="Accumulated Depreciation">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#777C92]">KES</span>
                        <input type="number" min="0" step="0.01" value={form.accumulatedDepreciation} onChange={(event) => updateForm("accumulatedDepreciation", event.target.value)} placeholder="0.00" className={`${inputClass} pl-14`} />
                      </div>
                    </Field>

                    <Field label="Residual Value">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#777C92]">KES</span>
                        <input type="number" min="0" step="0.01" value={form.residualValue} onChange={(event) => updateForm("residualValue", event.target.value)} placeholder="0.00" className={`${inputClass} pl-14`} />
                      </div>
                    </Field>

                    <Field label="Depreciation Method">
                      <select value={form.depreciationMethod} onChange={(event) => updateForm("depreciationMethod", event.target.value)} className={selectClass}>
                        <option value="">Select method</option>
                        <option value="STRAIGHT_LINE">Straight Line</option>
                        <option value="DECLINING_BALANCE">Declining Balance</option>
                        <option value="DOUBLE_DECLINING_BALANCE">Double Declining Balance</option>
                        <option value="UNITS_OF_PRODUCTION">Units of Production</option>
                      </select>
                    </Field>

                    <Field label="Useful Life">
                      <div className="relative">
                        <input type="number" min="1" step="1" value={form.usefulLife} onChange={(event) => updateForm("usefulLife", event.target.value)} placeholder="e.g. 5" className={`${inputClass} pr-16`} />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#777C92]">years</span>
                      </div>
                    </Field>

                    <Field label="Depreciation Start Date">
                      <input type="date" value={form.depreciationStartDate} onChange={(event) => updateForm("depreciationStartDate", event.target.value)} className={inputClass} />
                    </Field>

                    <Field label="Vendor / Supplier">
                      <input value={form.vendor} onChange={(event) => updateForm("vendor", event.target.value)} placeholder="Supplier or vendor name" className={inputClass} />
                    </Field>
                  </div>
                </section>


                {/* Lifecycle */}
                <section className="border-t border-[#ECECF3] pt-7">
                  <SectionHeader
                    icon={<CheckCircle2 size={18} />}
                    title="Lifecycle & Location"
                    description="Operational status, condition and where the asset is located."
                  />

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <Field
                      label="Status"
                      required
                    >
                      <select
                        value={form.status}
                        onChange={(event) =>
                          updateForm(
                            "status",
                            event.target.value
                          )
                        }
                        className={selectClass}
                      >
                        <option value="ACTIVE">
                          Active
                        </option>
                        <option value="ASSIGNED">
                          Assigned
                        </option>
                        <option value="INACTIVE">
                          Inactive
                        </option>
                        <option value="UNDER_MAINTENANCE">
                          Under Maintenance
                        </option>
                        <option value="DISPOSED">
                          Disposed
                        </option>
                      </select>
                    </Field>

                    <Field label="Condition">
                      <select
                        value={form.condition}
                        onChange={(event) =>
                          updateForm(
                            "condition",
                            event.target.value
                          )
                        }
                        className={selectClass}
                      >
                        <option value="">
                          Select condition
                        </option>
                        <option value="NEW">
                          New
                        </option>
                        <option value="EXCELLENT">
                          Excellent
                        </option>
                        <option value="GOOD">
                          Good
                        </option>
                        <option value="FAIR">
                          Fair
                        </option>
                        <option value="POOR">
                          Poor
                        </option>
                        <option value="DAMAGED">
                          Damaged
                        </option>
                      </select>
                    </Field>

                    <Field label="Location">
                      <input
                        value={form.location}
                        onChange={(event) =>
                          updateForm(
                            "location",
                            event.target.value
                          )
                        }
                        placeholder="e.g. Mombasa Office"
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Warranty Start">
                      <input
                        type="date"
                        value={form.warrantyStart}
                        onChange={(event) =>
                          updateForm(
                            "warrantyStart",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Warranty End">
                      <input
                        type="date"
                        value={form.warrantyEnd}
                        onChange={(event) =>
                          updateForm(
                            "warrantyEnd",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Notes">
                      <input
                        value={form.notes}
                        onChange={(event) =>
                          updateForm(
                            "notes",
                            event.target.value
                          )
                        }
                        placeholder="Additional asset information"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </section>

                {/* Computer */}
                {isComputerCategory(
                  form.category
                ) && (
                  <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
                    <SectionHeader
                      icon={<Laptop size={18} />}
                      title="Computer & Laptop Details"
                      description="Technical specifications and device identification."
                    />

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Processor">
                        <input
                          value={form.processor}
                          onChange={(event) =>
                            updateForm(
                              "processor",
                              event.target.value
                            )
                          }
                          placeholder="Intel Core Ultra 7"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="RAM">
                        <input
                          value={form.ram}
                          onChange={(event) =>
                            updateForm(
                              "ram",
                              event.target.value
                            )
                          }
                          placeholder="32 GB"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Storage">
                        <input
                          value={form.storage}
                          onChange={(event) =>
                            updateForm(
                              "storage",
                              event.target.value
                            )
                          }
                          placeholder="1 TB"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Storage Type">
                        <select
                          value={form.storageType}
                          onChange={(event) =>
                            updateForm(
                              "storageType",
                              event.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Select
                          </option>
                          <option value="SSD">
                            SSD
                          </option>
                          <option value="HDD">
                            HDD
                          </option>
                          <option value="NVME">
                            NVMe
                          </option>
                          <option value="EMMC">
                            eMMC
                          </option>
                        </select>
                      </Field>

                      <Field label="Operating System">
                        <input
                          value={form.operatingSystem}
                          onChange={(event) =>
                            updateForm(
                              "operatingSystem",
                              event.target.value
                            )
                          }
                          placeholder="Windows"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="OS Version">
                        <input
                          value={form.osVersion}
                          onChange={(event) =>
                            updateForm(
                              "osVersion",
                              event.target.value
                            )
                          }
                          placeholder="Windows 11 Pro"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="MAC Address">
                        <input
                          value={form.macAddress}
                          onChange={(event) =>
                            updateForm(
                              "macAddress",
                              event.target.value
                            )
                          }
                          placeholder="00:1A:2B:3C:4D:5E"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Hostname">
                        <input
                          value={form.hostname}
                          onChange={(event) =>
                            updateForm(
                              "hostname",
                              event.target.value
                            )
                          }
                          placeholder="ZIYA-LAPTOP-001"
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </section>
                )}

                {/* Mobile */}
                {isMobileCategory(
                  form.category
                ) && (
                  <section className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
                    <SectionHeader
                      icon={<Smartphone size={18} />}
                      title="Mobile & Tablet Details"
                      description="Device, SIM, network and mobile-management information."
                    />

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                      <Field label="IMEI">
                        <input
                          value={form.imei}
                          onChange={(event) =>
                            updateForm(
                              "imei",
                              event.target.value
                            )
                          }
                          placeholder="Primary IMEI"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="IMEI 2">
                        <input
                          value={form.imei2}
                          onChange={(event) =>
                            updateForm(
                              "imei2",
                              event.target.value
                            )
                          }
                          placeholder="Secondary IMEI"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Phone Number">
                        <input
                          value={form.phoneNumber}
                          onChange={(event) =>
                            updateForm(
                              "phoneNumber",
                              event.target.value
                            )
                          }
                          placeholder="+254..."
                          className={inputClass}
                        />
                      </Field>

                      <Field label="SIM / ICCID">
                        <input
                          value={form.simIccid}
                          onChange={(event) =>
                            updateForm(
                              "simIccid",
                              event.target.value
                            )
                          }
                          placeholder="SIM identifier"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Carrier">
                        <input
                          value={form.carrier}
                          onChange={(event) =>
                            updateForm(
                              "carrier",
                              event.target.value
                            )
                          }
                          placeholder="Safaricom"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Storage">
                        <input
                          value={form.storageCapacity}
                          onChange={(event) =>
                            updateForm(
                              "storageCapacity",
                              event.target.value
                            )
                          }
                          placeholder="256 GB"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Color">
                        <input
                          value={form.color}
                          onChange={(event) =>
                            updateForm(
                              "color",
                              event.target.value
                            )
                          }
                          placeholder="Black"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Enrollment Status">
                        <select
                          value={form.enrollmentStatus}
                          onChange={(event) =>
                            updateForm(
                              "enrollmentStatus",
                              event.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Select
                          </option>
                          <option value="NOT_ENROLLED">
                            Not Enrolled
                          </option>
                          <option value="ENROLLED">
                            Enrolled
                          </option>
                          <option value="ACTIVE">
                            Active
                          </option>
                          <option value="RETIRED">
                            Retired
                          </option>
                        </select>
                      </Field>

                      <Field label="MDM Device ID">
                        <input
                          value={form.mdmDeviceId}
                          onChange={(event) =>
                            updateForm(
                              "mdmDeviceId",
                              event.target.value
                            )
                          }
                          placeholder="Device management ID"
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </section>
                )}

                {/* Vehicle */}
                {isVehicleCategory(
                  form.category
                ) && (
                  <section className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5">
                    <SectionHeader
                      icon={<Truck size={18} />}
                      title="Vehicle Details"
                      description="Vehicle identification, specifications and operational information."
                    />

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Registration Number">
                        <input
                          value={
                            form.registrationNumber
                          }
                          onChange={(event) =>
                            updateForm(
                              "registrationNumber",
                              event.target.value
                            )
                          }
                          placeholder="KDA 123A"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="VIN / Chassis">
                        <input
                          value={form.vin}
                          onChange={(event) =>
                            updateForm(
                              "vin",
                              event.target.value
                            )
                          }
                          placeholder="Vehicle identification number"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Chassis Number">
                        <input
                          value={form.chassisNumber}
                          onChange={(event) =>
                            updateForm(
                              "chassisNumber",
                              event.target.value
                            )
                          }
                          placeholder="Chassis number"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Engine Number">
                        <input
                          value={form.engineNumber}
                          onChange={(event) =>
                            updateForm(
                              "engineNumber",
                              event.target.value
                            )
                          }
                          placeholder="Engine number"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Year">
                        <input
                          type="number"
                          min="1900"
                          max={
                            new Date().getFullYear() + 1
                          }
                          value={form.year}
                          onChange={(event) =>
                            updateForm(
                              "year",
                              event.target.value
                            )
                          }
                          placeholder="2025"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Vehicle Type">
                        <input
                          value={form.vehicleType}
                          onChange={(event) =>
                            updateForm(
                              "vehicleType",
                              event.target.value
                            )
                          }
                          placeholder="Motor Vehicle"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Body Type">
                        <input
                          value={form.bodyType}
                          onChange={(event) =>
                            updateForm(
                              "bodyType",
                              event.target.value
                            )
                          }
                          placeholder="SUV, Sedan, Pickup..."
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Fuel Type">
                        <select
                          value={form.fuelType}
                          onChange={(event) =>
                            updateForm(
                              "fuelType",
                              event.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Select
                          </option>
                          <option value="PETROL">
                            Petrol
                          </option>
                          <option value="DIESEL">
                            Diesel
                          </option>
                          <option value="HYBRID">
                            Hybrid
                          </option>
                          <option value="ELECTRIC">
                            Electric
                          </option>
                          <option value="OTHER">
                            Other
                          </option>
                        </select>
                      </Field>

                      <Field label="Fuel Capacity">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.fuelCapacity}
                          onChange={(event) =>
                            updateForm(
                              "fuelCapacity",
                              event.target.value
                            )
                          }
                          placeholder="Litres"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Transmission">
                        <select
                          value={form.transmission}
                          onChange={(event) =>
                            updateForm(
                              "transmission",
                              event.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Select
                          </option>
                          <option value="MANUAL">
                            Manual
                          </option>
                          <option value="AUTOMATIC">
                            Automatic
                          </option>
                          <option value="CVT">
                            CVT
                          </option>
                          <option value="OTHER">
                            Other
                          </option>
                        </select>
                      </Field>

                      <Field label="Odometer">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.odometer}
                          onChange={(event) =>
                            updateForm(
                              "odometer",
                              event.target.value
                            )
                          }
                          placeholder="Current kilometres"
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Engine Hours">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={form.engineHours}
                          onChange={(event) =>
                            updateForm(
                              "engineHours",
                              event.target.value
                            )
                          }
                          placeholder="Optional"
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <div className="mt-6 border-t border-amber-100 pt-6">
                      <p className="mb-4 text-sm font-semibold text-[#20243A]">
                        Compliance & Insurance
                      </p>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                        <Field label="Insurance Policy Number">
                          <input
                            value={
                              form.insurancePolicyNumber
                            }
                            onChange={(event) =>
                              updateForm(
                                "insurancePolicyNumber",
                                event.target.value
                              )
                            }
                            placeholder="Policy number"
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Insurance Expiry">
                          <input
                            type="date"
                            value={
                              form.insuranceExpiry
                            }
                            onChange={(event) =>
                              updateForm(
                                "insuranceExpiry",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Registration Expiry">
                          <input
                            type="date"
                            value={
                              form.registrationExpiry
                            }
                            onChange={(event) =>
                              updateForm(
                                "registrationExpiry",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Inspection Expiry">
                          <input
                            type="date"
                            value={
                              form.inspectionExpiry
                            }
                            onChange={(event) =>
                              updateForm(
                                "inspectionExpiry",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-amber-100 pt-6">
                      <p className="mb-4 text-sm font-semibold text-[#20243A]">
                        Maintenance
                      </p>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        <Field label="Last Service Date">
                          <input
                            type="date"
                            value={
                              form.lastServiceDate
                            }
                            onChange={(event) =>
                              updateForm(
                                "lastServiceDate",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Next Service Date">
                          <input
                            type="date"
                            value={
                              form.nextServiceDate
                            }
                            onChange={(event) =>
                              updateForm(
                                "nextServiceDate",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Maintenance Notes">
                          <input
                            value={
                              form.maintenanceNotes
                            }
                            onChange={(event) =>
                              updateForm(
                                "maintenanceNotes",
                                event.target.value
                              )
                            }
                            placeholder="Maintenance information"
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 flex shrink-0 justify-end gap-3 border-t border-[#ECECF3] bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={saving}
                  className="rounded-xl border border-[#DCDDEA] px-5 py-2.5 text-sm font-semibold text-[#555A70] transition hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? "Creating Asset..."
                    : "Create Fixed Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Asset Modal */}
      {viewingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl ${categoryBadgeClass(
                    viewingAsset.category
                  )}`}
                >
                  {categoryIcon(
                    viewingAsset.category
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-[#20243A]">
                    {viewingAsset.name}
                  </h2>

                  <p className="mt-0.5 text-sm font-medium text-[#0D9488]">
                    {viewingAsset.assetCode}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setViewingAsset(null)
                }
                className="rounded-xl p-2 text-[#777C92] transition hover:bg-[#F8F9FC] hover:text-[#20243A]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-6">
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl bg-[#F8F9FC] p-4">
                  <p className="text-xs font-medium text-[#777C92]">
                    Category
                  </p>

                  <p className="mt-2 font-semibold text-[#20243A]">
                    {viewingAsset.category}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F8F9FC] p-4">
                  <p className="text-xs font-medium text-[#777C92]">
                    Status
                  </p>

                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                      viewingAsset.status
                    )}`}
                  >
                    {statusLabel(
                      viewingAsset.status
                    )}
                  </span>
                </div>

                <div className="rounded-2xl bg-[#F8F9FC] p-4">
                  <p className="text-xs font-medium text-[#777C92]">
                    Purchase Cost
                  </p>

                  <p className="mt-2 font-semibold text-[#20243A]">
                    {formatCurrency(
                      viewingAsset.purchaseCost ??
                        viewingAsset.value
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F8F9FC] p-4">
                  <p className="text-xs font-medium text-[#777C92]">
                    Book Value
                  </p>

                  <p className="mt-2 font-semibold text-[#20243A]">
                    {formatCurrency(
                      viewingAsset.currentBookValue ??
                        viewingAsset.purchaseCost ??
                        viewingAsset.value
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#ECECF3] p-5">
                  <h3 className="mb-4 font-semibold text-[#20243A]">
                    Asset Information
                  </h3>

                  <div className="space-y-3 text-sm">
                    <DetailRow
                      label="Manufacturer"
                      value={
                        viewingAsset.manufacturer
                      }
                    />

                    <DetailRow
                      label="Model"
                      value={viewingAsset.model}
                    />

                    <DetailRow
                      label="Serial Number"
                      value={
                        viewingAsset.serialNumber
                      }
                    />

                    <DetailRow
                      label="Service Tag"
                      value={
                        viewingAsset.serviceTag
                      }
                    />

                    <DetailRow
                      label="Condition"
                      value={
                        viewingAsset.condition
                      }
                    />

                    <DetailRow
                      label="Location"
                      value={
                        viewingAsset.location
                      }
                    />

                    <DetailRow
                      label="Vendor"
                      value={
                        viewingAsset.vendor
                      }
                    />

                    <DetailRow
                      label="Purchase Date"
                      value={formatDate(
                        viewingAsset.purchaseDate
                      )}
                    />
                  </div>
                </div>

                {isComputerCategory(
                  viewingAsset.category
                ) && (
                  <div className="rounded-2xl border border-[#ECECF3] p-5">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-[#20243A]">
                      <Laptop
                        size={18}
                        className="text-[#0D9488]"
                      />
                      Computer Details
                    </h3>

                    <div className="space-y-3 text-sm">
                      <DetailRow
                        label="Processor"
                        value={
                          viewingAsset.processor
                        }
                      />

                      <DetailRow
                        label="RAM"
                        value={viewingAsset.ram}
                      />

                      <DetailRow
                        label="Storage"
                        value={
                          viewingAsset.storage
                        }
                      />

                      <DetailRow
                        label="Storage Type"
                        value={
                          viewingAsset.storageType
                        }
                      />

                      <DetailRow
                        label="Operating System"
                        value={
                          viewingAsset.operatingSystem
                        }
                      />

                      <DetailRow
                        label="OS Version"
                        value={
                          viewingAsset.osVersion
                        }
                      />

                      <DetailRow
                        label="MAC Address"
                        value={
                          viewingAsset.macAddress
                        }
                      />

                      <DetailRow
                        label="Hostname"
                        value={
                          viewingAsset.hostname
                        }
                      />
                    </div>
                  </div>
                )}

                {isMobileCategory(
                  viewingAsset.category
                ) && (
                  <div className="rounded-2xl border border-[#ECECF3] p-5">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-[#20243A]">
                      <Smartphone
                        size={18}
                        className="text-[#0D9488]"
                      />
                      Mobile Details
                    </h3>

                    <div className="space-y-3 text-sm">
                      <DetailRow
                        label="IMEI"
                        value={
                          viewingAsset.imei
                        }
                      />

                      <DetailRow
                        label="IMEI 2"
                        value={
                          viewingAsset.imei2
                        }
                      />

                      <DetailRow
                        label="Phone Number"
                        value={
                          viewingAsset.phoneNumber
                        }
                      />

                      <DetailRow
                        label="SIM / ICCID"
                        value={
                          viewingAsset.simIccid
                        }
                      />

                      <DetailRow
                        label="Carrier"
                        value={
                          viewingAsset.carrier
                        }
                      />

                      <DetailRow
                        label="Storage"
                        value={
                          viewingAsset.storageCapacity
                        }
                      />

                      <DetailRow
                        label="Color"
                        value={
                          viewingAsset.color
                        }
                      />

                      <DetailRow
                        label="Enrollment"
                        value={
                          viewingAsset.enrollmentStatus
                        }
                      />
                    </div>
                  </div>
                )}

                {isVehicleCategory(
                  viewingAsset.category
                ) && (
                  <div className="rounded-2xl border border-[#ECECF3] p-5 lg:col-span-2">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold text-[#20243A]">
                      <Truck
                        size={18}
                        className="text-[#0D9488]"
                      />
                      Vehicle Details
                    </h3>

                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                      <DetailRow
                        label="Registration Number"
                        value={
                          viewingAsset.registrationNumber
                        }
                      />

                      <DetailRow
                        label="VIN"
                        value={
                          viewingAsset.vin
                        }
                      />

                      <DetailRow
                        label="Engine Number"
                        value={
                          viewingAsset.engineNumber
                        }
                      />

                      <DetailRow
                        label="Year"
                        value={
                          viewingAsset.year
                            ? String(
                                viewingAsset.year
                              )
                            : null
                        }
                      />

                      <DetailRow
                        label="Vehicle Type"
                        value={
                          viewingAsset.vehicleType
                        }
                      />

                      <DetailRow
                        label="Body Type"
                        value={
                          viewingAsset.bodyType
                        }
                      />

                      <DetailRow
                        label="Fuel Type"
                        value={
                          viewingAsset.fuelType
                        }
                      />

                      <DetailRow
                        label="Transmission"
                        value={
                          viewingAsset.transmission
                        }
                      />

                      <DetailRow
                        label="Odometer"
                        value={
                          viewingAsset.odometer !==
                          null &&
                          viewingAsset.odometer !==
                            undefined
                            ? `${viewingAsset.odometer} km`
                            : null
                        }
                      />

                      <DetailRow
                        label="Insurance Policy"
                        value={
                          viewingAsset.insurancePolicyNumber
                        }
                      />

                      <DetailRow
                        label="Insurance Expiry"
                        value={formatDate(
                          viewingAsset.insuranceExpiry
                        )}
                      />

                      <DetailRow
                        label="Registration Expiry"
                        value={formatDate(
                          viewingAsset.registrationExpiry
                        )}
                      />

                      <DetailRow
                        label="Inspection Expiry"
                        value={formatDate(
                          viewingAsset.inspectionExpiry
                        )}
                      />

                      <DetailRow
                        label="Last Service"
                        value={formatDate(
                          viewingAsset.lastServiceDate
                        )}
                      />

                      <DetailRow
                        label="Next Service"
                        value={formatDate(
                          viewingAsset.nextServiceDate
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-[#ECECF3] p-5 lg:col-span-2">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-[#20243A]">
                    <CalendarDays
                      size={18}
                      className="text-[#0D9488]"
                    />
                    Warranty & Notes
                  </h3>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <DetailRow
                      label="Warranty Start"
                      value={formatDate(
                        viewingAsset.warrantyStart
                      )}
                    />

                    <DetailRow
                      label="Warranty End"
                      value={formatDate(
                        viewingAsset.warrantyEnd
                      )}
                    />

                    <DetailRow
                      label="Created"
                      value={formatDate(
                        viewingAsset.createdAt
                      )}
                    />

                    <DetailRow
                      label="Last Updated"
                      value={formatDate(
                        viewingAsset.updatedAt
                      )}
                    />
                  </div>

                  {viewingAsset.notes && (
                    <div className="mt-5 rounded-xl bg-[#F8F9FC] p-4">
                      <p className="text-xs font-medium text-[#777C92]">
                        Notes
                      </p>

                      <p className="mt-1 text-sm leading-6 text-[#555A70]">
                        {viewingAsset.notes}
                      </p>
                    </div>
                  )}

                  {viewingAsset.maintenanceNotes && (
                    <div className="mt-4 rounded-xl bg-[#F8F9FC] p-4">
                      <p className="text-xs font-medium text-[#777C92]">
                        Maintenance Notes
                      </p>

                      <p className="mt-1 text-sm leading-6 text-[#555A70]">
                        {viewingAsset.maintenanceNotes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-3 border-t border-[#ECECF3] bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  const asset =
                    assets.find(
                      (item) =>
                        item.id ===
                        viewingAsset.id
                    );

                  setViewingAsset(null);

                  if (asset) {
                    openEditModal(asset);
                  }
                }}
                className="flex items-center gap-2 rounded-xl border border-[#DCDDEA] px-5 py-2.5 text-sm font-semibold text-[#555A70] transition hover:bg-[#F8F9FC]"
              >
                <Pencil size={16} />
                Edit Asset
              </button>

              <button
                type="button"
                disabled={
                  deletingAssetId ===
                  viewingAsset.id
                }
                onClick={() =>
                  void deleteAsset(
                    viewingAsset
                  )
                }
                className="flex items-center gap-2 rounded-xl border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {deletingAssetId ===
                viewingAsset.id ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={16} />
                )}

                Delete
              </button>

              <button
                type="button"
                onClick={() =>
                  setViewingAsset(null)
                }
                className="rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F766E]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#ECECF3] px-6 py-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-[#20243A]">
                    Edit Fixed Asset
                  </h2>

                  <span className="rounded-full bg-[#EAF7F5] px-2.5 py-1 text-xs font-semibold text-[#0D9488]">
                    {editingAsset.assetCode}
                  </span>
                </div>

                <p className="mt-1 text-sm text-[#777C92]">
                  Update the asset register information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={editingSaving}
                className="rounded-xl p-2 text-[#777C92] transition hover:bg-[#F8F9FC]"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={submitEdit}
              className="min-h-0 overflow-y-auto"
            >
              <div className="space-y-7 p-6">
                {editError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {editError}
                  </div>
                )}

                <div className="rounded-2xl border border-[#BCE7E1] bg-[#F1FBF9] p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2
                      size={19}
                      className="mt-0.5 shrink-0 text-[#0D9488]"
                    />

                    <div>
                      <p className="text-sm font-semibold text-[#20243A]">
                        Asset Code
                      </p>

                      <p className="mt-1 text-sm font-bold text-[#0D9488]">
                        {editingAsset.assetCode}
                      </p>

                      <p className="mt-1 text-xs text-[#777C92]">
                        Asset codes are system-generated and cannot be changed.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Basic Information */}
                <section>
                  <SectionHeader
                    icon={<FileText size={18} />}
                    title="Basic Information"
                    description="Core information used to identify and classify the asset."
                  />

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field
                      label="Asset Name"
                      required
                    >
                      <input
                        value={editForm.name}
                        onChange={(event) =>
                          updateEditForm(
                            "name",
                            event.target.value
                          )
                        }
                        required
                        className={inputClass}
                      />
                    </Field>

                    <Field
                      label="Category"
                      required
                    >
                      <select
                        value={editForm.category}
                        onChange={(event) =>
                          updateEditForm(
                            "category",
                            event.target.value
                          )
                        }
                        required
                        className={selectClass}
                      >
                        <option value="">
                          Select category
                        </option>
                        <option value="Computer">
                          Computer
                        </option>
                        <option value="Laptop">
                          Laptop
                        </option>
                        <option value="Mobile Phone">
                          Mobile Phone
                        </option>
                        <option value="Tablet">
                          Tablet
                        </option>
                        <option value="Vehicle">
                          Vehicle
                        </option>
                        <option value="Furniture">
                          Furniture
                        </option>
                        <option value="Equipment">
                          Equipment
                        </option>
                        <option value="Office Equipment">
                          Office Equipment
                        </option>
                        <option value="Machinery">
                          Machinery
                        </option>
                        <option value="Other">
                          Other
                        </option>
                      </select>
                    </Field>

                    <Field label="Manufacturer / Make">
                      <input
                        value={
                          editForm.manufacturer
                        }
                        onChange={(event) =>
                          updateEditForm(
                            "manufacturer",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Model">
                      <input
                        value={editForm.model}
                        onChange={(event) =>
                          updateEditForm(
                            "model",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field
                      label="Serial Number"
                      required={isComputerCategory(
                        editForm.category
                      )}
                    >
                      <input
                        value={
                          editForm.serialNumber
                        }
                        onChange={(event) =>
                          updateEditForm(
                            "serialNumber",
                            event.target.value
                          )
                        }
                        required={isComputerCategory(
                          editForm.category
                        )}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Service Tag / Product Number">
                      <input
                        value={
                          editForm.serviceTag
                        }
                        onChange={(event) =>
                          updateEditForm(
                            "serviceTag",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </section>

                {/* Financial */}
                <section className="border-t border-[#ECECF3] pt-7">
                  <SectionHeader
                    icon={<FileText size={18} />}
                    title="Financial Information"
                    description="Acquisition cost and current accounting value."
                  />

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <Field label="Purchase Date">
                      <input
                        type="date"
                        value={
                          editForm.purchaseDate
                        }
                        onChange={(event) =>
                          updateEditForm(
                            "purchaseDate",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Purchase Cost">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          editForm.purchaseCost
                        }
                        onChange={(event) =>
                          updateEditForm(
                            "purchaseCost",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Current Book Value">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          editForm.currentBookValue
                        }
                        onChange={(event) =>
                          updateEditForm(
                            "currentBookValue",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field
                      label="Asset Value"
                      required
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.value}
                        onChange={(event) =>
                          updateEditForm(
                            "value",
                            event.target.value
                          )
                        }
                        required
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Vendor / Supplier">
                      <input
                        value={editForm.vendor}
                        onChange={(event) =>
                          updateEditForm(
                            "vendor",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </section>

                {/* Lifecycle */}
                <section className="border-t border-[#ECECF3] pt-7">
                  <SectionHeader
                    icon={<CheckCircle2 size={18} />}
                    title="Lifecycle & Location"
                    description="Operational status, condition and location."
                  />

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <Field label="Status">
                      <select
                        value={editForm.status}
                        onChange={(event) =>
                          updateEditForm(
                            "status",
                            event.target.value
                          )
                        }
                        className={selectClass}
                      >
                        <option value="ACTIVE">
                          Active
                        </option>
                        <option value="ASSIGNED">
                          Assigned
                        </option>
                        <option value="INACTIVE">
                          Inactive
                        </option>
                        <option value="UNDER_MAINTENANCE">
                          Under Maintenance
                        </option>
                        <option value="DISPOSED">
                          Disposed
                        </option>
                      </select>
                    </Field>

                    <Field label="Condition">
                      <select
                        value={editForm.condition}
                        onChange={(event) =>
                          updateEditForm(
                            "condition",
                            event.target.value
                          )
                        }
                        className={selectClass}
                      >
                        <option value="">
                          Select condition
                        </option>
                        <option value="NEW">
                          New
                        </option>
                        <option value="EXCELLENT">
                          Excellent
                        </option>
                        <option value="GOOD">
                          Good
                        </option>
                        <option value="FAIR">
                          Fair
                        </option>
                        <option value="POOR">
                          Poor
                        </option>
                        <option value="DAMAGED">
                          Damaged
                        </option>
                      </select>
                    </Field>

                    <Field label="Location">
                      <input
                        value={editForm.location}
                        onChange={(event) =>
                          updateEditForm(
                            "location",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Warranty Start">
                      <input
                        type="date"
                        value={
                          editForm.warrantyStart
                        }
                        onChange={(event) =>
                          updateEditForm(
                            "warrantyStart",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Warranty End">
                      <input
                        type="date"
                        value={
                          editForm.warrantyEnd
                        }
                        onChange={(event) =>
                          updateEditForm(
                            "warrantyEnd",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Notes">
                      <input
                        value={editForm.notes}
                        onChange={(event) =>
                          updateEditForm(
                            "notes",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </section>

                {/* Computer */}
                {isComputerCategory(
                  editForm.category
                ) && (
                  <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5">
                    <SectionHeader
                      icon={<Laptop size={18} />}
                      title="Computer & Laptop Details"
                      description="Technical specifications and device identification."
                    />

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Processor">
                        <input
                          value={editForm.processor}
                          onChange={(event) =>
                            updateEditForm(
                              "processor",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="RAM">
                        <input
                          value={editForm.ram}
                          onChange={(event) =>
                            updateEditForm(
                              "ram",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Storage">
                        <input
                          value={editForm.storage}
                          onChange={(event) =>
                            updateEditForm(
                              "storage",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Storage Type">
                        <select
                          value={
                            editForm.storageType
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "storageType",
                              event.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Select
                          </option>
                          <option value="SSD">
                            SSD
                          </option>
                          <option value="HDD">
                            HDD
                          </option>
                          <option value="NVME">
                            NVMe
                          </option>
                          <option value="EMMC">
                            eMMC
                          </option>
                        </select>
                      </Field>

                      <Field label="Operating System">
                        <input
                          value={
                            editForm.operatingSystem
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "operatingSystem",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="OS Version">
                        <input
                          value={editForm.osVersion}
                          onChange={(event) =>
                            updateEditForm(
                              "osVersion",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="MAC Address">
                        <input
                          value={editForm.macAddress}
                          onChange={(event) =>
                            updateEditForm(
                              "macAddress",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Hostname">
                        <input
                          value={editForm.hostname}
                          onChange={(event) =>
                            updateEditForm(
                              "hostname",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </section>
                )}

                {/* Mobile */}
                {isMobileCategory(
                  editForm.category
                ) && (
                  <section className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5">
                    <SectionHeader
                      icon={<Smartphone size={18} />}
                      title="Mobile & Tablet Details"
                      description="Device, SIM, network and management information."
                    />

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                      <Field label="IMEI">
                        <input
                          value={editForm.imei}
                          onChange={(event) =>
                            updateEditForm(
                              "imei",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="IMEI 2">
                        <input
                          value={editForm.imei2}
                          onChange={(event) =>
                            updateEditForm(
                              "imei2",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Phone Number">
                        <input
                          value={
                            editForm.phoneNumber
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "phoneNumber",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="SIM / ICCID">
                        <input
                          value={editForm.simIccid}
                          onChange={(event) =>
                            updateEditForm(
                              "simIccid",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Carrier">
                        <input
                          value={editForm.carrier}
                          onChange={(event) =>
                            updateEditForm(
                              "carrier",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Storage">
                        <input
                          value={
                            editForm.storageCapacity
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "storageCapacity",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Color">
                        <input
                          value={editForm.color}
                          onChange={(event) =>
                            updateEditForm(
                              "color",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Enrollment Status">
                        <select
                          value={
                            editForm.enrollmentStatus
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "enrollmentStatus",
                              event.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Select
                          </option>
                          <option value="NOT_ENROLLED">
                            Not Enrolled
                          </option>
                          <option value="ENROLLED">
                            Enrolled
                          </option>
                          <option value="ACTIVE">
                            Active
                          </option>
                          <option value="RETIRED">
                            Retired
                          </option>
                        </select>
                      </Field>

                      <Field label="MDM Device ID">
                        <input
                          value={
                            editForm.mdmDeviceId
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "mdmDeviceId",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </section>
                )}

                {/* Vehicle */}
                {isVehicleCategory(
                  editForm.category
                ) && (
                  <section className="rounded-2xl border border-amber-100 bg-amber-50/40 p-5">
                    <SectionHeader
                      icon={<Truck size={18} />}
                      title="Vehicle Details"
                      description="Vehicle identification, compliance and maintenance information."
                    />

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                      <Field label="Registration Number">
                        <input
                          value={
                            editForm.registrationNumber
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "registrationNumber",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="VIN / Chassis">
                        <input
                          value={editForm.vin}
                          onChange={(event) =>
                            updateEditForm(
                              "vin",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Chassis Number">
                        <input
                          value={
                            editForm.chassisNumber
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "chassisNumber",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Engine Number">
                        <input
                          value={
                            editForm.engineNumber
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "engineNumber",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Year">
                        <input
                          type="number"
                          min="1900"
                          max={
                            new Date().getFullYear() + 1
                          }
                          value={editForm.year}
                          onChange={(event) =>
                            updateEditForm(
                              "year",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Vehicle Type">
                        <input
                          value={
                            editForm.vehicleType
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "vehicleType",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Body Type">
                        <input
                          value={
                            editForm.bodyType
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "bodyType",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Fuel Type">
                        <select
                          value={
                            editForm.fuelType
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "fuelType",
                              event.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Select
                          </option>
                          <option value="PETROL">
                            Petrol
                          </option>
                          <option value="DIESEL">
                            Diesel
                          </option>
                          <option value="HYBRID">
                            Hybrid
                          </option>
                          <option value="ELECTRIC">
                            Electric
                          </option>
                          <option value="OTHER">
                            Other
                          </option>
                        </select>
                      </Field>

                      <Field label="Fuel Capacity">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            editForm.fuelCapacity
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "fuelCapacity",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Transmission">
                        <select
                          value={
                            editForm.transmission
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "transmission",
                              event.target.value
                            )
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Select
                          </option>
                          <option value="MANUAL">
                            Manual
                          </option>
                          <option value="AUTOMATIC">
                            Automatic
                          </option>
                          <option value="CVT">
                            CVT
                          </option>
                          <option value="OTHER">
                            Other
                          </option>
                        </select>
                      </Field>

                      <Field label="Odometer">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={
                            editForm.odometer
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "odometer",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Engine Hours">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={
                            editForm.engineHours
                          }
                          onChange={(event) =>
                            updateEditForm(
                              "engineHours",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        />
                      </Field>
                    </div>

                    <div className="mt-6 border-t border-amber-100 pt-6">
                      <p className="mb-4 text-sm font-semibold text-[#20243A]">
                        Compliance & Insurance
                      </p>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                        <Field label="Insurance Policy Number">
                          <input
                            value={
                              editForm.insurancePolicyNumber
                            }
                            onChange={(event) =>
                              updateEditForm(
                                "insurancePolicyNumber",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Insurance Expiry">
                          <input
                            type="date"
                            value={
                              editForm.insuranceExpiry
                            }
                            onChange={(event) =>
                              updateEditForm(
                                "insuranceExpiry",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Registration Expiry">
                          <input
                            type="date"
                            value={
                              editForm.registrationExpiry
                            }
                            onChange={(event) =>
                              updateEditForm(
                                "registrationExpiry",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Inspection Expiry">
                          <input
                            type="date"
                            value={
                              editForm.inspectionExpiry
                            }
                            onChange={(event) =>
                              updateEditForm(
                                "inspectionExpiry",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-amber-100 pt-6">
                      <p className="mb-4 text-sm font-semibold text-[#20243A]">
                        Maintenance
                      </p>

                      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                        <Field label="Last Service Date">
                          <input
                            type="date"
                            value={
                              editForm.lastServiceDate
                            }
                            onChange={(event) =>
                              updateEditForm(
                                "lastServiceDate",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Next Service Date">
                          <input
                            type="date"
                            value={
                              editForm.nextServiceDate
                            }
                            onChange={(event) =>
                              updateEditForm(
                                "nextServiceDate",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>

                        <Field label="Maintenance Notes">
                          <input
                            value={
                              editForm.maintenanceNotes
                            }
                            onChange={(event) =>
                              updateEditForm(
                                "maintenanceNotes",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <div className="sticky bottom-0 flex shrink-0 justify-end gap-3 border-t border-[#ECECF3] bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={editingSaving}
                  className="rounded-xl border border-[#DCDDEA] px-5 py-2.5 text-sm font-semibold text-[#555A70] transition hover:bg-[#F8F9FC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={editingSaving}
                  className="flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editingSaving && (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {editingSaving
                    ? "Saving Changes..."
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  const displayValue =
    value && value.trim()
      ? value
      : "â€”";

  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#F0F0F5] pb-2.5 last:border-0 last:pb-0">
      <span className="text-[#777C92]">
        {label}
      </span>

      <span className="max-w-[65%] text-right font-medium text-[#20243A]">
        {displayValue}
      </span>
    </div>
  );
}






