import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Mail,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from "lucide-react";
import { authenticatedFetch } from "../lib/auth";

type User = {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  role: string;
  permissions: string[];
  membershipActive: boolean;
  accountActive: boolean;
  joinedAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  invitedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type Role = {
  role: string;
  permissions: string[];
};

type ModalState =
  | { type: "none" }
  | { type: "deactivate"; user: User }
  | { type: "remove"; user: User }
  | { type: "revoke"; invitation: Invitation }
  | { type: "viewInvitation"; invitation: Invitation };

type FormState = {
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  permissions: string[];
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

const PERMISSION_LABELS: Record<string, string> = {
  "users.view": "View users",
  "users.create": "Invite users",
  "users.manageAccess": "Manage access",
  "users.manageStatus": "Manage user status",
  "users.delete": "Remove users",

  "account.view": "View accounts",
  "account.create": "Create accounts",
  "account.update": "Update accounts",
  "account.delete": "Delete accounts",

  "accountsPayable.view": "View accounts payable",
  "accountsPayable.create": "Create payables",
  "accountsPayable.approve": "Approve payables",
  "accountsPayable.payment": "Make payable payments",
  "accountsPayable.delete": "Delete payables",

  "accountsReceivable.view": "View accounts receivable",
  "accountsReceivable.create": "Create receivables",
  "accountsReceivable.update": "Update receivables",
  "accountsReceivable.approve": "Approve receivables",
  "accountsReceivable.payment": "Receive payments",
  "accountsReceivable.delete": "Delete receivables",

  "approval.view": "View approvals",
  "approval.approve": "Approve workflows",
  "approval.reject": "Reject workflows",

  "bankAccount.view": "View bank accounts",
  "bankAccount.create": "Create bank accounts",
  "bankAccount.update": "Update bank accounts",
  "bankAccount.delete": "Delete bank accounts",

  "bankPayment.view": "View bank payments",
  "bankPayment.create": "Create bank payments",

  "budget.view": "View budgets",
  "budget.create": "Create budgets",
  "budget.update": "Update budgets",
  "budget.delete": "Delete budgets",

  "document.view": "View documents",
  "document.create": "Create documents",
  "document.delete": "Delete documents",

  "expense.view": "View expenses",
  "expense.create": "Create expenses",

  "fraud.view": "View fraud controls",
  "fraud.analyze": "Analyze fraud",

  "investment.view": "View investments",
  "investment.create": "Create investments",

  "invoice.view": "View invoices",
  "invoice.create": "Create invoices",

  "journal.view": "View journals",
  "journal.create": "Create journals",
  "journal.update": "Update journals",
  "journal.post": "Post journals",
  "journal.approve": "Approve journals",
  "journal.reverse": "Reverse journals",
  "journal.delete": "Delete journals",

  "ledger.view": "View general ledger",

  "portfolioCompany.view": "View portfolio companies",
  "portfolioCompany.create": "Create portfolio companies",
  "portfolioCompany.update": "Update portfolio companies",
  "portfolioCompany.delete": "Delete portfolio companies",

  "procurement.view": "View procurement",
  "procurement.create": "Create procurement",
  "procurement.update": "Update procurement",
  "procurement.status": "Manage procurement status",

  "employee.view": "View employees",
  "employee.create": "Create employees",
  "employee.update": "Update employees",
  "employee.delete": "Delete employees",

  "payroll.view": "View payroll",
  "payroll.create": "Create payroll",
  "payroll.update": "Update payroll",

  "asset.view": "View assets",
  "asset.create": "Create assets",
  "asset.update": "Update assets",
  "asset.delete": "Delete assets",

  "assetAssignment.view": "View asset assignments",
  "assetAssignment.create": "Create asset assignments",
  "assetAssignment.update": "Update asset assignments",

  "reports.view": "View reports",

  "vendor.view": "View vendors",
  "vendor.create": "Create vendors",
  "vendor.update": "Update vendors",
  "vendor.status": "Manage vendor status",
  "vendor.delete": "Delete vendors",

  "tax.view": "View tax management",
  "tax.create": "Create tax records",
  "tax.file": "File tax returns",
  "tax.payment": "Record tax payments",

  "security.sessions.view": "View security sessions",
  "security.sessions.revoke": "Revoke security sessions",
};

const PERMISSION_GROUPS: Array<{
  label: string;
  permissions: string[];
}> = [
  {
    label: "Organization & access",
    permissions: [
      "users.view",
      "users.create",
      "users.manageAccess",
      "users.manageStatus",
      "users.delete",
    ],
  },
  {
    label: "Accounting",
    permissions: [
      "account.view",
      "account.create",
      "account.update",
      "account.delete",
      "journal.view",
      "journal.create",
      "journal.update",
      "journal.post",
      "journal.approve",
      "journal.reverse",
      "journal.delete",
      "ledger.view",
    ],
  },
  {
    label: "Accounts payable",
    permissions: [
      "accountsPayable.view",
      "accountsPayable.create",
      "accountsPayable.approve",
      "accountsPayable.payment",
      "accountsPayable.delete",
    ],
  },
  {
    label: "Accounts receivable",
    permissions: [
      "accountsReceivable.view",
      "accountsReceivable.create",
      "accountsReceivable.update",
      "accountsReceivable.approve",
      "accountsReceivable.payment",
      "accountsReceivable.delete",
    ],
  },
  {
    label: "Sales & invoices",
    permissions: ["invoice.view", "invoice.create"],
  },
  {
    label: "Expenses & budgets",
    permissions: [
      "expense.view",
      "expense.create",
      "budget.view",
      "budget.create",
      "budget.update",
      "budget.delete",
    ],
  },
  {
    label: "Banking",
    permissions: [
      "bankAccount.view",
      "bankAccount.create",
      "bankAccount.update",
      "bankAccount.delete",
      "bankPayment.view",
      "bankPayment.create",
    ],
  },
  {
    label: "Procurement & vendors",
    permissions: [
      "procurement.view",
      "procurement.create",
      "procurement.update",
      "procurement.status",
      "vendor.view",
      "vendor.create",
      "vendor.update",
      "vendor.status",
      "vendor.delete",
    ],
  },
  {
    label: "Assets",
    permissions: [
      "asset.view",
      "asset.create",
      "asset.update",
      "asset.delete",
      "assetAssignment.view",
      "assetAssignment.create",
      "assetAssignment.update",
    ],
  },
  {
    label: "HR & payroll",
    permissions: [
      "employee.view",
      "employee.create",
      "employee.update",
      "employee.delete",
      "payroll.view",
      "payroll.create",
      "payroll.update",
    ],
  },
  {
    label: "Reporting & controls",
    permissions: [
      "reports.view",
      "fraud.view",
      "fraud.analyze",
      "tax.view",
      "tax.create",
      "tax.file",
      "tax.payment",
      "approval.view",
      "approval.approve",
      "approval.reject",
    ],
  },
  {
    label: "Investments & portfolio",
    permissions: [
      "investment.view",
      "investment.create",
      "portfolioCompany.view",
      "portfolioCompany.create",
      "portfolioCompany.update",
      "portfolioCompany.delete",
    ],
  },
  {
    label: "Documents & security",
    permissions: [
      "document.view",
      "document.create",
      "document.delete",
      "security.sessions.view",
      "security.sessions.revoke",
    ],
  },
];

const TENANT_ASSIGNABLE_ROLES = [
  "FINANCE_MANAGER",
  "ACCOUNTANT",
  "FINANCE_OFFICER",
  "ACCOUNTS_PAYABLE_OFFICER",
  "ACCOUNTS_RECEIVABLE_OFFICER",
  "PROCUREMENT_OFFICER",
  "HR_MANAGER",
  "ASSET_MANAGER",
  "APPROVER",
  "AUDITOR",
  "VIEWER",
  "CUSTOM",
];

const formatRole = (role: string) =>
  role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const roleLabel = (role: string) =>
  role === "OWNER" ? "Owner / Company Admin" : formatRole(role);

const permissionLabel = (permission: string) =>
  PERMISSION_LABELS[permission] || permission;

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isInvitationExpired = (invitation: Invitation) =>
  invitation.status === "EXPIRED" ||
  new Date(invitation.expiresAt).getTime() <= Date.now();

const invitationState = (invitation: Invitation) => {
  if (invitation.status === "REVOKED") return "REVOKED";
  if (invitation.status === "ACCEPTED") return "ACCEPTED";
  if (isInvitationExpired(invitation)) return "EXPIRED";
  return "PENDING";
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "U";

const roleColors = (role: string) => {
  switch (role) {
    case "OWNER":
      return "border-[#D8C07A] bg-[#FBF7E8] text-[#806B25]";
    case "FINANCE_MANAGER":
    case "ACCOUNTANT":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "FINANCE_OFFICER":
    case "ACCOUNTS_PAYABLE_OFFICER":
    case "ACCOUNTS_RECEIVABLE_OFFICER":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "PROCUREMENT_OFFICER":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "HR_MANAGER":
      return "border-pink-200 bg-pink-50 text-pink-700";
    case "ASSET_MANAGER":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";
    case "APPROVER":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "AUDITOR":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "VIEWER":
      return "border-gray-200 bg-gray-50 text-gray-600";
    case "CUSTOM":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    default:
      return "border-[#E5E7EF] bg-[#F7F8FC] text-[#555B72]";
  }
};

const api = async (url: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {};

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await authenticatedFetch(url, {
    ...options,
    headers: {
      ...headers,
      ...((options.headers as Record<string, string> | undefined) || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      typeof data?.message === "string"
        ? data.message
        : `Request failed (${response.status})`,
    );
    (error as Error & { status?: number; code?: string }).status =
      response.status;
    (error as Error & { status?: number; code?: string }).code =
      typeof data?.code === "string" ? data.code : undefined;
    throw error;
  }

  return data;
};

const getApiItems = <T,>(
  result: unknown,
  key: string,
): T[] => {
  if (!result || typeof result !== "object") return [];
  const record = result as Record<string, unknown>;
  return Array.isArray(record[key]) ? (record[key] as T[]) : [];
};

export default function UsersAccess() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"people" | "invitations">(
    "people",
  );
  const [search, setSearch] = useState("");
  const [invitationFilter, setInvitationFilter] = useState<
    "ALL" | "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED"
  >("ALL");

  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [invitationPage, setInvitationPage] = useState(1);
  const [invitationPageSize, setInvitationPageSize] =
    useState(DEFAULT_PAGE_SIZE);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phoneNumber: "",
    role: "ACCOUNTANT",
    permissions: [],
  });

  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [viewPermissions, setViewPermissions] = useState(false);

  const requestSequence = useRef(0);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSuccess = useCallback((message: string) => {
    if (successTimer.current) {
      clearTimeout(successTimer.current);
    }

    setSuccess(message);

    successTimer.current = setTimeout(() => {
      setSuccess("");
      successTimer.current = null;
    }, 5000);
  }, []);

  const load = useCallback(async (silent = false) => {
    const sequence = ++requestSequence.current;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [userResult, roleResult, invitationResult] =
        await Promise.all([
          api("/api/users"),
          api("/api/roles"),
          api("/api/users/invitations"),
        ]);

      if (sequence !== requestSequence.current) return;

      setUsers(getApiItems<User>(userResult, "users"));
      setRoles(
        getApiItems<Role>(roleResult, "roles").filter(
          (role) =>
            role.role !== "OWNER" &&
            TENANT_ASSIGNABLE_ROLES.includes(role.role),
        ),
      );
      setInvitations(
        getApiItems<Invitation>(invitationResult, "invitations"),
      );
      setLastUpdatedAt(new Date().toISOString());
    } catch (caught) {
      if (sequence !== requestSequence.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load users and access information.",
      );
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (successTimer.current) {
        clearTimeout(successTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (modal.type !== "none") {
          setModal({ type: "none" });
          return;
        }

        if (inviteOpen || editUser) {
          setInviteOpen(false);
          setEditUser(null);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editUser, inviteOpen, modal.type]);

  useEffect(() => {
    const hasModal = inviteOpen || !!editUser || modal.type !== "none";

    if (!hasModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [editUser, inviteOpen, modal.type]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!normalizedSearch) return users;

    return users.filter((user) => {
      const permissionText = user.permissions
        .map(permissionLabel)
        .join(" ")
        .toLowerCase();

      return (
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        (user.phoneNumber || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        roleLabel(user.role).toLowerCase().includes(normalizedSearch) ||
        permissionText.includes(normalizedSearch)
      );
    });
  }, [normalizedSearch, users]);

  const filteredInvitations = useMemo(() => {
    return invitations.filter((invitation) => {
      const state = invitationState(invitation);

      if (
        invitationFilter !== "ALL" &&
        state !== invitationFilter
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const permissionText = invitation.permissions
        .map(permissionLabel)
        .join(" ")
        .toLowerCase();

      const invitedBy = invitation.invitedBy
        ? `${invitation.invitedBy.name} ${invitation.invitedBy.email}`
        : "";

      return (
        invitation.email.toLowerCase().includes(normalizedSearch) ||
        roleLabel(invitation.role)
          .toLowerCase()
          .includes(normalizedSearch) ||
        permissionText.includes(normalizedSearch) ||
        invitedBy.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [invitationFilter, invitations, normalizedSearch]);

  const userTotalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / userPageSize),
  );

  const invitationTotalPages = Math.max(
    1,
    Math.ceil(filteredInvitations.length / invitationPageSize),
  );

  useEffect(() => {
    setUserPage((page) => Math.min(page, userTotalPages));
  }, [userTotalPages]);

  useEffect(() => {
    setInvitationPage((page) =>
      Math.min(page, invitationTotalPages),
    );
  }, [invitationTotalPages]);

  useEffect(() => {
    setUserPage(1);
    setInvitationPage(1);
  }, [normalizedSearch, invitationFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  const paginatedInvitations = useMemo(() => {
    const start = (invitationPage - 1) * invitationPageSize;
    return filteredInvitations.slice(
      start,
      start + invitationPageSize,
    );
  }, [
    filteredInvitations,
    invitationPage,
    invitationPageSize,
  ]);

  const activeUsers = users.filter(
    (user) => user.membershipActive && user.accountActive,
  ).length;

  const inactiveUsers = users.length - activeUsers;

  const pendingInvitations = invitations.filter(
    (invitation) => invitationState(invitation) === "PENDING",
  ).length;

  const expiredInvitations = invitations.filter(
    (invitation) => invitationState(invitation) === "EXPIRED",
  ).length;

  const acceptedInvitations = invitations.filter(
    (invitation) => invitationState(invitation) === "ACCEPTED",
  ).length;

  const revokedInvitations = invitations.filter(
    (invitation) => invitationState(invitation) === "REVOKED",
  ).length;

  const selectedRole = roles.find(
    (role) => role.role === form.role,
  );

  const customPermissions = Object.keys(PERMISSION_LABELS);

  const selectedPermissionCount =
    form.role === "CUSTOM"
      ? form.permissions.length
      : selectedRole?.permissions.length || 0;

  const selectedPermissionList =
    form.role === "CUSTOM"
      ? form.permissions
      : selectedRole?.permissions || [];

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      phoneNumber: "",
      role: roles[0]?.role || "ACCOUNTANT",
      permissions: [],
    });
    setViewPermissions(false);
  };

  const openInvite = () => {
    setEditUser(null);
    resetForm();
    setInviteOpen(true);
  };

  const openEdit = (user: User) => {
    if (user.role === "OWNER") {
      setError("The organization owner cannot be modified from this screen.");
      return;
    }

    setInviteOpen(false);
    setEditUser(user);
    setForm({
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      role: user.role,
      permissions: [...user.permissions],
    });
    setViewPermissions(false);
  };

  const closeAccessModal = () => {
    setInviteOpen(false);
    setEditUser(null);
    setViewPermissions(false);
  };

  const togglePermission = (permission: string) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter(
            (item) => item !== permission,
          )
        : [...current.permissions, permission],
    }));
  };

  const togglePermissionGroup = (permissions: string[]) => {
    setForm((current) => {
      const allSelected = permissions.every((permission) =>
        current.permissions.includes(permission),
      );

      if (allSelected) {
        return {
          ...current,
          permissions: current.permissions.filter(
            (permission) => !permissions.includes(permission),
          ),
        };
      }

      const merged = new Set(current.permissions);
      permissions.forEach((permission) => merged.add(permission));

      return {
        ...current,
        permissions: Array.from(merged),
      };
    });
  };

  const validateInvite = () => {
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (!name) {
      setError("Full name is required.");
      return false;
    }

    if (!email) {
      setError("Email address is required.");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return false;
    }

    if (!form.role) {
      setError("Select an organization role.");
      return false;
    }

    if (
      form.role === "CUSTOM" &&
      form.permissions.length === 0
    ) {
      setError(
        "Select at least one permission for a custom role.",
      );
      return false;
    }

    return true;
  };

  const submitInvite = async () => {
    if (!validateInvite()) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const result = await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phoneNumber:
            form.phoneNumber.trim() || undefined,
          role: form.role,
          permissions:
            form.role === "CUSTOM"
              ? form.permissions
              : undefined,
        }),
      });

      closeAccessModal();
      await load(true);

      showSuccess(
        result?.invitationSent
          ? `Invitation sent to ${form.email.trim().toLowerCase()}.`
          : "Invitation was created, but the email could not be delivered. The invitation remains available for resend.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to create the invitation.",
      );
    } finally {
      setSaving(false);
    }
  };

  const saveAccess = async () => {
    if (!editUser) return;

    if (
      form.role === "CUSTOM" &&
      form.permissions.length === 0
    ) {
      setError(
        "Select at least one permission for a custom role.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/api/users/${encodeURIComponent(
          editUser.membershipId,
        )}/access`,
        {
          method: "PATCH",
          body: JSON.stringify({
            role: form.role,
            permissions:
              form.role === "CUSTOM"
                ? form.permissions
                : undefined,
          }),
        },
      );

      closeAccessModal();
      await load(true);
      showSuccess("User access was updated successfully.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update user access.",
      );
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (user: User) => {
    if (user.role === "OWNER") {
      setError(
        "The organization owner cannot be deactivated from this screen.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/api/users/${encodeURIComponent(
          user.membershipId,
        )}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !user.membershipActive,
          }),
        },
      );

      setModal({ type: "none" });
      await load(true);

      showSuccess(
        user.membershipActive
          ? `${user.name}'s organization access has been disabled.`
          : `${user.name}'s organization access has been restored.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to change the user's access status.",
      );
    } finally {
      setSaving(false);
    }
  };

  const resendInvitation = async (
    invitation: Invitation,
  ) => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const result = await api(
        `/api/users/invitations/${encodeURIComponent(
          invitation.id,
        )}/resend`,
        {
          method: "POST",
        },
      );

      await load(true);

      showSuccess(
        result?.invitationSent
          ? `Invitation sent to ${invitation.email}.`
          : "The invitation was regenerated, but the email could not be delivered.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to resend the invitation.",
      );
    } finally {
      setSaving(false);
    }
  };

  const revokeInvitation = async (
    invitation: Invitation,
  ) => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/api/users/invitations/${encodeURIComponent(
          invitation.id,
        )}`,
        {
          method: "DELETE",
        },
      );

      setModal({ type: "none" });
      await load(true);
      showSuccess(
        `Invitation for ${invitation.email} was revoked.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to revoke the invitation.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (user: User) => {
    if (user.role === "OWNER") {
      setError(
        "The organization owner cannot be removed from this screen.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api(
        `/api/users/${encodeURIComponent(
          user.membershipId,
        )}`,
        {
          method: "DELETE",
        },
      );

      setModal({ type: "none" });
      await load(true);
      showSuccess(
        `${user.name} was removed from the organization.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to remove the user.",
      );
    } finally {
      setSaving(false);
    }
  };

  const renderPagination = (
    currentPage: number,
    totalPages: number,
    pageSize: number,
    totalItems: number,
    onPageChange: (page: number) => void,
    onPageSizeChange: (size: number) => void,
  ) => {
    const start =
      totalItems === 0
        ? 0
        : (currentPage - 1) * pageSize + 1;
    const end =
      totalItems === 0
        ? 0
        : Math.min(currentPage * pageSize, totalItems);

    const pageNumbers = Array.from(
      new Set(
        [
          1,
          currentPage - 1,
          currentPage,
          currentPage + 1,
          totalPages,
        ].filter(
          (page) => page >= 1 && page <= totalPages,
        ),
      ),
    );

    return (
      <div className="flex flex-col gap-3 border-t border-[#ECEEF4] bg-[#FAFBFD] px-5 py-3 text-xs text-[#73798D] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Showing{" "}
            <span className="font-semibold text-[#454A60]">
              {start}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-[#454A60]">
              {end}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-[#454A60]">
              {totalItems}
            </span>
          </span>

          <label className="flex items-center gap-2">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(event) => {
                onPageSizeChange(
                  Number(event.target.value),
                );
                onPageChange(1);
              }}
              className="h-8 rounded-lg border border-[#DDE0EA] bg-white px-2 text-xs font-medium text-[#454A60] outline-none focus:border-[#20243A]"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() =>
              onPageChange(currentPage - 1)
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE0EA] bg-white text-[#555B72] transition hover:bg-[#F4F5F9] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>

          {pageNumbers.map((page) => (
            <button
              type="button"
              key={page}
              onClick={() => onPageChange(page)}
              className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-semibold transition ${
                page === currentPage
                  ? "border-[#20243A] bg-[#20243A] text-white"
                  : "border-[#DDE0EA] bg-white text-[#555B72] hover:bg-[#F4F5F9]"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() =>
              onPageChange(currentPage + 1)
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#DDE0EA] bg-white text-[#555B72] transition hover:bg-[#F4F5F9] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const accessSummary = (permissions: string[]) => {
    if (permissions.includes("*")) {
      return "Full organization access";
    }

    if (permissions.length === 0) {
      return "No permissions assigned";
    }

    const visible = permissions
      .slice(0, 3)
      .map(permissionLabel);

    const remaining = permissions.length - visible.length;

    return remaining > 0
      ? `${visible.join(", ")} +${remaining} more`
      : visible.join(", ");
  };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-[#F6F7FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#E7E9F1]">
            <RefreshCw
              className="animate-spin text-[#20243A]"
              size={20}
            />
          </div>
          <p className="text-sm font-medium text-[#777C91]">
            Loading users and access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#F6F7FB] px-4 py-6 text-[#20243A] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#8A8FA5]">
              <a
                href="/dashboard/settings"
                className="transition hover:text-[#20243A]"
              >
                Settings
              </a>
              <span>/</span>
              <span className="text-[#555B72]">
                Users & Access
              </span>
            </div>

            <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[#20243A] sm:text-[32px]">
              Users & Access
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#747A90]">
              Manage who can access this organization,
              what they can see, and which financial
              actions they are authorized to perform.
            </p>

            {lastUpdatedAt && (
              <p className="mt-2 text-[11px] text-[#9A9EAF]">
                Last updated {formatDateTime(lastUpdatedAt)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={openInvite}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#20243A] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(32,36,58,0.14)] transition hover:-translate-y-0.5 hover:bg-[#171A2C]"
          >
            <UserPlus size={17} />
            Invite user
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700"
          >
            <AlertCircle
              size={17}
              className="mt-0.5 shrink-0"
            />
            <span className="flex-1">{error}</span>
            <button
              type="button"
              className="font-bold opacity-70 hover:opacity-100"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700"
          >
            <CheckCircle2
              size={17}
              className="mt-0.5 shrink-0"
            />
            <span className="flex-1">{success}</span>
            <button
              type="button"
              className="font-bold opacity-70 hover:opacity-100"
              onClick={() => setSuccess("")}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Total users"
            value={users.length}
            detail="People with organization access"
            icon={<Users size={18} />}
          />

          <SummaryCard
            label="Active users"
            value={activeUsers}
            detail="Currently able to access FOS"
            tone="green"
            icon={<CheckCircle2 size={18} />}
          />

          <SummaryCard
            label="Inactive users"
            value={inactiveUsers}
            detail="Organization access disabled"
            tone="amber"
            icon={<UserX size={18} />}
          />

          <SummaryCard
            label="Pending invitations"
            value={pendingInvitations}
            detail="Waiting to join the workspace"
            tone="blue"
            icon={<Mail size={18} />}
          />
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl border border-[#E5E7EF] bg-white p-1 shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
          <TabButton
            active={activeTab === "people"}
            onClick={() => setActiveTab("people")}
            icon={<Users size={15} />}
            label="People"
            count={users.length}
          />

          <TabButton
            active={activeTab === "invitations"}
            onClick={() => setActiveTab("invitations")}
            icon={<Mail size={15} />}
            label="Invitations"
            count={pendingInvitations}
            countTone="blue"
          />

          <div className="ml-auto hidden items-center gap-4 px-3 text-[11px] text-[#9297AA] lg:flex">
            <span>{acceptedInvitations} accepted</span>
            <span>{expiredInvitations} expired</span>
            <span>{revokedInvitations} revoked</span>
          </div>
        </div>

        {activeTab === "people" ? (
          <section className="overflow-hidden rounded-2xl border border-[#E5E7EF] bg-white shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
            <div className="border-b border-[#E7E9F0] px-5 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#20243A]">
                    People with FOS access
                  </h2>
                  <p className="mt-1 text-xs text-[#8A8FA5]">
                    Each person's access is enforced by
                    organization membership and backend
                    permissions.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                  <div className="relative min-w-0 sm:w-[360px]">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-3.5 text-[#9A9EAF]"
                    />
                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search name, email, role or access..."
                      className="h-10 w-full rounded-xl border border-[#DDE0EA] bg-[#FBFCFE] pl-10 pr-3.5 text-sm text-[#30354A] outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:bg-white focus:ring-2 focus:ring-[#20243A]/5"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void load(true)}
                    disabled={refreshing || saving}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DDE0EA] bg-white px-4 text-xs font-semibold text-[#555B72] transition hover:bg-[#F7F8FC] disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={
                        refreshing
                          ? "animate-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead className="border-b border-[#ECEEF4] bg-[#FAFBFD]">
                  <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                    <th className="px-5 py-3.5">
                      User
                    </th>
                    <th className="px-5 py-3.5">
                      Role
                    </th>
                    <th className="px-5 py-3.5">
                      Access
                    </th>
                    <th className="px-5 py-3.5">
                      Status
                    </th>
                    <th className="px-5 py-3.5">
                      Joined
                    </th>
                    <th className="px-5 py-3.5 text-right">
                      Manage
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedUsers.map((user) => {
                    const isActive =
                      user.membershipActive &&
                      user.accountActive;

                    return (
                      <tr
                        key={user.membershipId}
                        className="border-b border-[#F0F1F5] last:border-b-0 transition hover:bg-[#FCFCFE]"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#20243A] text-xs font-bold text-white">
                              {initials(user.name)}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-[#30354A]">
                                {user.name}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-[#8A8FA5]">
                                {user.email}
                              </div>
                              {user.phoneNumber && (
                                <div className="mt-0.5 text-[10px] text-[#A0A5B6]">
                                  {user.phoneNumber}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${roleColors(
                              user.role,
                            )}`}
                          >
                            <Shield size={11} />
                            {roleLabel(user.role)}
                          </span>
                        </td>

                        <td className="max-w-[320px] px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs text-[#656B80]">
                              {accessSummary(
                                user.permissions,
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: "viewInvitation",
                                  invitation: {
                                    id: user.membershipId,
                                    email: user.email,
                                    role: user.role,
                                    permissions:
                                      user.permissions,
                                    status: isActive
                                      ? "ACTIVE"
                                      : "INACTIVE",
                                    expiresAt: "",
                                    createdAt:
                                      user.joinedAt,
                                    invitedBy: null,
                                  },
                                })
                              }
                              className="shrink-0 rounded-lg p-1.5 text-[#777C91] transition hover:bg-[#F1F2F7] hover:text-[#20243A]"
                              title="View access"
                              aria-label={`View ${user.name}'s access`}
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-emerald-700">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-red-600">
                              <span className="h-2 w-2 rounded-full bg-red-500" />
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-xs text-[#777C91]">
                          {formatDate(user.joinedAt)}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              disabled={
                                saving ||
                                user.role ===
                                  "OWNER"
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE0EA] bg-white px-3 text-xs font-semibold text-[#454A60] transition hover:border-[#C9CCD8] hover:bg-[#F7F8FC] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Pencil size={13} />
                              Manage access
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: "deactivate",
                                  user,
                                })
                              }
                              disabled={
                                saving ||
                                user.role ===
                                  "OWNER"
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#DDE0EA] bg-white text-[#666B80] transition hover:bg-[#F7F8FC] disabled:cursor-not-allowed disabled:opacity-35"
                              title={
                                user.membershipActive
                                  ? "Deactivate access"
                                  : "Activate access"
                              }
                              aria-label={
                                user.membershipActive
                                  ? `Deactivate ${user.name}`
                                  : `Activate ${user.name}`
                              }
                            >
                              <MoreHorizontal
                                size={16}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setModal({
                                  type: "remove",
                                  user,
                                })
                              }
                              disabled={
                                saving ||
                                user.role ===
                                  "OWNER"
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35"
                              title="Remove from organization"
                              aria-label={`Remove ${user.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedUsers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-20 text-center"
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F2F7]">
                          <UserX
                            size={20}
                            className="text-[#8A8FA5]"
                          />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-[#555B72]">
                          No users found
                        </p>
                        <p className="mt-1 text-xs text-[#9A9EAF]">
                          Try a different search term or
                          invite a new user.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {renderPagination(
              userPage,
              userTotalPages,
              userPageSize,
              filteredUsers.length,
              setUserPage,
              setUserPageSize,
            )}
          </section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[#E5E7EF] bg-white shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
            <div className="border-b border-[#E7E9F0] px-5 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#20243A]">
                    Invitations
                  </h2>
                  <p className="mt-1 text-xs text-[#8A8FA5]">
                    Track who has been invited, the access
                    they will receive, and the state of
                    each invitation.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 sm:w-[320px]">
                    <Search
                      size={15}
                      className="absolute left-3.5 top-3.5 text-[#9A9EAF]"
                    />
                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Search recipient, role or access..."
                      className="h-10 w-full rounded-xl border border-[#DDE0EA] bg-[#FBFCFE] pl-10 pr-3.5 text-sm text-[#30354A] outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:bg-white focus:ring-2 focus:ring-[#20243A]/5"
                    />
                  </div>

                  <select
                    value={invitationFilter}
                    onChange={(event) =>
                      setInvitationFilter(
                        event.target.value as typeof invitationFilter,
                      )
                    }
                    className="h-10 rounded-xl border border-[#DDE0EA] bg-white px-3 text-xs font-semibold text-[#555B72] outline-none focus:border-[#20243A]"
                  >
                    <option value="ALL">
                      All invitations
                    </option>
                    <option value="PENDING">
                      Pending
                    </option>
                    <option value="EXPIRED">
                      Expired
                    </option>
                    <option value="ACCEPTED">
                      Accepted
                    </option>
                    <option value="REVOKED">
                      Revoked
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={() => void load(true)}
                    disabled={refreshing || saving}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#DDE0EA] bg-white px-4 text-xs font-semibold text-[#555B72] transition hover:bg-[#F7F8FC] disabled:opacity-50"
                  >
                    <RefreshCw
                      size={14}
                      className={
                        refreshing
                          ? "animate-spin"
                          : ""
                      }
                    />
                    Refresh
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b border-[#ECEEF4] sm:grid-cols-4">
              <InvitationMetric
                label="Pending"
                value={pendingInvitations}
                tone="blue"
              />
              <InvitationMetric
                label="Expired"
                value={expiredInvitations}
                tone="amber"
              />
              <InvitationMetric
                label="Accepted"
                value={acceptedInvitations}
                tone="green"
              />
              <InvitationMetric
                label="Revoked"
                value={revokedInvitations}
                tone="gray"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="border-b border-[#ECEEF4] bg-[#FAFBFD]">
                  <tr className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                    <th className="px-5 py-3.5">
                      Recipient
                    </th>
                    <th className="px-5 py-3.5">
                      Role
                    </th>
                    <th className="px-5 py-3.5">
                      Access
                    </th>
                    <th className="px-5 py-3.5">
                      Status
                    </th>
                    <th className="px-5 py-3.5">
                      Sent
                    </th>
                    <th className="px-5 py-3.5">
                      Expires
                    </th>
                    <th className="px-5 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedInvitations.map(
                    (invitation) => {
                      const state =
                        invitationState(
                          invitation,
                        );

                      return (
                        <tr
                          key={invitation.id}
                          className="border-b border-[#F0F1F5] last:border-b-0 transition hover:bg-[#FCFCFE]"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F1F2F7] text-xs font-bold text-[#555B72]">
                                <Mail size={16} />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[#30354A]">
                                  {invitation.email}
                                </div>
                                <div className="mt-0.5 truncate text-[11px] text-[#9297AA]">
                                  {invitation.invitedBy
                                    ? `Invited by ${invitation.invitedBy.name}`
                                    : "Organization invitation"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${roleColors(
                                invitation.role,
                              )}`}
                            >
                              <Shield size={11} />
                              {roleLabel(
                                invitation.role,
                              )}
                            </span>
                          </td>

                          <td className="max-w-[300px] px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-xs text-[#656B80]">
                                {accessSummary(
                                  invitation.permissions,
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setModal({
                                    type: "viewInvitation",
                                    invitation,
                                  })
                                }
                                className="shrink-0 rounded-lg p-1.5 text-[#777C91] transition hover:bg-[#F1F2F7] hover:text-[#20243A]"
                                title="View invitation access"
                                aria-label="View invitation access"
                              >
                                <Eye size={14} />
                              </button>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <InvitationStatus
                              state={state}
                            />
                          </td>

                          <td className="px-5 py-4 text-xs text-[#777C91]">
                            {formatDate(
                              invitation.createdAt,
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs text-[#777C91]">
                            {state === "ACCEPTED" ||
                            state === "REVOKED"
                              ? "—"
                              : formatDate(
                                  invitation.expiresAt,
                                )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1.5">
                              {(state === "PENDING" ||
                                state === "EXPIRED") && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void resendInvitation(
                                      invitation,
                                    )
                                  }
                                  disabled={saving}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE0EA] bg-white px-3 text-xs font-semibold text-[#454A60] transition hover:bg-[#F7F8FC] disabled:opacity-50"
                                >
                                  <RefreshCw
                                    size={13}
                                  />
                                  Resend
                                </button>
                              )}

                              {state === "PENDING" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setModal({
                                      type: "revoke",
                                      invitation,
                                    })
                                  }
                                  disabled={saving}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                >
                                  <X size={13} />
                                  Revoke
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}

                  {paginatedInvitations.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-20 text-center"
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F2F7]">
                          <Mail
                            size={20}
                            className="text-[#8A8FA5]"
                          />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-[#555B72]">
                          No invitations found
                        </p>
                        <p className="mt-1 text-xs text-[#9A9EAF]">
                          Invitations matching the selected
                          filters will appear here.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {renderPagination(
              invitationPage,
              invitationTotalPages,
              invitationPageSize,
              filteredInvitations.length,
              setInvitationPage,
              setInvitationPageSize,
            )}
          </section>
        )}
      </div>

      {(inviteOpen || editUser) && (
        <AccessModal
          editUser={editUser}
          form={form}
          roles={roles}
          selectedRole={selectedRole}
          selectedPermissionCount={
            selectedPermissionCount
          }
          selectedPermissionList={
            selectedPermissionList
          }
          customPermissions={customPermissions}
          viewPermissions={viewPermissions}
          saving={saving}
          onClose={closeAccessModal}
          onChange={setForm}
          onTogglePermission={togglePermission}
          onTogglePermissionGroup={
            togglePermissionGroup
          }
          onTogglePermissionView={() =>
            setViewPermissions((value) => !value)
          }
          onSubmit={
            editUser ? saveAccess : submitInvite
          }
        />
      )}

      {modal.type !== "none" && (
        <ConfirmOrDetailModal
          modal={modal}
          saving={saving}
          onClose={() =>
            setModal({ type: "none" })
          }
          onDeactivate={changeStatus}
          onRemove={removeUser}
          onRevoke={revokeInvitation}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  tone = "gray",
}: {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  tone?: "gray" | "green" | "amber" | "blue";
}) {
  const styles = {
    gray: {
      bg: "bg-[#F1F2F7]",
      text: "text-[#555B72]",
      detail: "text-[#8A8FA5]",
    },
    green: {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      detail: "text-emerald-600",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-600",
      detail: "text-[#8A8FA5]",
    },
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-600",
      detail: "text-[#8A8FA5]",
    },
  }[tone];

  return (
    <div className="rounded-2xl border border-[#E5E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(32,36,58,0.025)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[#20243A]">
            {value}
          </p>
          <p
            className={`mt-1 text-xs ${styles.detail}`}
          >
            {detail}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.bg}`}
        >
          <span className={styles.text}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
  countTone = "gray",
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count: number;
  countTone?: "gray" | "blue";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition ${
        active
          ? "bg-[#20243A] text-white shadow-sm"
          : "text-[#656B80] hover:bg-[#F5F6FA] hover:text-[#20243A]"
      }`}
    >
      {icon}
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
          active
            ? "bg-white/15 text-white"
            : countTone === "blue"
              ? "bg-blue-50 text-blue-700"
              : "bg-[#F1F2F7] text-[#777C91]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function InvitationMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "amber" | "green" | "gray";
}) {
  const styles = {
    blue: "text-blue-700",
    amber: "text-amber-700",
    green: "text-emerald-700",
    gray: "text-[#555B72]",
  }[tone];

  return (
    <div className="border-r border-[#ECEEF4] px-5 py-4 last:border-r-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${styles}`}>
        {value}
      </p>
    </div>
  );
}

function InvitationStatus({
  state,
}: {
  state: string;
}) {
  const config = {
    PENDING: {
      label: "Pending",
      className:
        "bg-blue-50 text-blue-700 border-blue-100",
      icon: <Clock3 size={12} />,
    },
    EXPIRED: {
      label: "Expired",
      className:
        "bg-amber-50 text-amber-700 border-amber-100",
      icon: <Clock3 size={12} />,
    },
    ACCEPTED: {
      label: "Accepted",
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-100",
      icon: <CheckCircle2 size={12} />,
    },
    REVOKED: {
      label: "Revoked",
      className:
        "bg-slate-50 text-slate-600 border-slate-200",
      icon: <X size={12} />,
    },
  }[state as "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED"];

  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

function AccessModal({
  editUser,
  form,
  roles,
  selectedRole,
  selectedPermissionCount,
  selectedPermissionList,
  customPermissions,
  viewPermissions,
  saving,
  onClose,
  onChange,
  onTogglePermission,
  onTogglePermissionGroup,
  onTogglePermissionView,
  onSubmit,
}: {
  editUser: User | null;
  form: FormState;
  roles: Role[];
  selectedRole?: Role;
  selectedPermissionCount: number;
  selectedPermissionList: string[];
  customPermissions: string[];
  viewPermissions: boolean;
  saving: boolean;
  onClose: () => void;
  onChange: (
    value:
      | FormState
      | ((current: FormState) => FormState),
  ) => void;
  onTogglePermission: (permission: string) => void;
  onTogglePermissionGroup: (
    permissions: string[],
  ) => void;
  onTogglePermissionView: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111526]/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="max-h-[94vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_24px_80px_rgba(20,24,40,0.25)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-modal-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-start justify-between border-b border-[#E7E9F0] px-6 py-5">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F1F2F7]">
                {editUser ? (
                  <Shield
                    size={17}
                    className="text-[#555B72]"
                  />
                ) : (
                  <UserPlus
                    size={17}
                    className="text-[#555B72]"
                  />
                )}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                {editUser
                  ? "Access management"
                  : "Organization access"}
              </span>
            </div>

            <h2
              id="access-modal-title"
              className="text-xl font-bold tracking-tight text-[#20243A]"
            >
              {editUser
                ? "Manage user access"
                : "Invite a new user"}
            </h2>

            <p className="mt-1 text-xs leading-5 text-[#7B8094]">
              {editUser
                ? "Update the person's role and FOS permissions. Changes are enforced by the organization backend."
                : "Review the exact access before sending the secure invitation."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#777C91] transition hover:bg-[#F4F5F9] hover:text-[#20243A]"
            aria-label="Close access dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[66vh] overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  value={form.name}
                  disabled={!!editUser}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Jane Doe"
                  className="h-11 w-full rounded-xl border border-[#DDE0EA] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/5 disabled:bg-[#F5F6FA]"
                />
              </Field>

              <Field label="Email address">
                <div className="relative">
                  <Mail
                    className="absolute left-3.5 top-3.5 text-[#9A9EAF]"
                    size={16}
                  />
                  <input
                    value={form.email}
                    disabled={!!editUser}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="name@company.com"
                    className="h-11 w-full rounded-xl border border-[#DDE0EA] bg-white py-3 pl-10 pr-3.5 text-sm outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/5 disabled:bg-[#F5F6FA]"
                  />
                </div>
              </Field>
            </div>

            {!editUser && (
              <Field label="Phone number" hint="optional">
                <input
                  value={form.phoneNumber}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      phoneNumber: event.target.value,
                    }))
                  }
                  placeholder="+254 7XX XXX XXX"
                  className="h-11 w-full rounded-xl border border-[#DDE0EA] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#A0A5B6] focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/5"
                />
              </Field>
            )}

            <Field label="Organization role">
              <select
                value={form.role}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    role: event.target.value,
                    permissions: [],
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#DDE0EA] bg-white px-3.5 text-sm font-medium text-[#30354A] outline-none transition focus:border-[#20243A] focus:ring-2 focus:ring-[#20243A]/5"
              >
                {roles.map((role) => (
                  <option
                    key={role.role}
                    value={role.role}
                  >
                    {roleLabel(role.role)}
                  </option>
                ))}
                {!roles.some(
                  (role) => role.role === "CUSTOM",
                ) && (
                  <option value="CUSTOM">
                    Custom Role
                  </option>
                )}
              </select>
            </Field>

            <div className="rounded-2xl border border-[#E5E7EF] bg-[#F9FAFC] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#30354A]">
                    Access that will be granted
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#8A8FA5]">
                    This is the access that will be enforced
                    for this organization.
                  </p>
                </div>

                <span className="w-fit rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#555B72] ring-1 ring-[#E5E7EF]">
                  {selectedPermissionCount} permissions
                </span>
              </div>

              {form.role !== "CUSTOM" ? (
                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {selectedRole?.permissions.map(
                    (permission) => (
                      <div
                        key={permission}
                        className="flex items-center gap-2.5 rounded-xl border border-[#ECEEF4] bg-white px-3 py-2.5"
                      >
                        <CheckCircle2
                          size={14}
                          className="shrink-0 text-emerald-500"
                        />
                        <span className="text-xs text-[#555B72]">
                          {permissionLabel(
                            permission,
                          )}
                        </span>
                      </div>
                    ),
                  )}

                  {!selectedRole?.permissions.length && (
                    <p className="text-xs text-[#8A8FA5]">
                      No permissions are defined for this
                      role.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {PERMISSION_GROUPS.map((group) => {
                      const selected = group.permissions.filter(
                        (permission) =>
                          form.permissions.includes(
                            permission,
                          ),
                      ).length;

                      return (
                        <button
                          type="button"
                          key={group.label}
                          onClick={() =>
                            onTogglePermissionGroup(
                              group.permissions,
                            )
                          }
                          className={`rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
                            selected ===
                            group.permissions.length
                              ? "border-[#20243A] bg-[#20243A] text-white"
                              : "border-[#DDE0EA] bg-white text-[#555B72] hover:bg-[#F4F5F9]"
                          }`}
                        >
                          {group.label}{" "}
                          {selected}/
                          {group.permissions.length}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {customPermissions.map(
                      (permission) => (
                        <label
                          key={permission}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                            form.permissions.includes(
                              permission,
                            )
                              ? "border-[#BFC4D2] bg-[#F7F8FC]"
                              : "border-[#ECEEF4] bg-white hover:bg-[#FAFBFD]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(
                              permission,
                            )}
                            onChange={() =>
                              onTogglePermission(
                                permission,
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-xs text-[#555B72]">
                            {permissionLabel(
                              permission,
                            )}
                          </span>
                        </label>
                      ),
                    )}
                  </div>
                </>
              )}
            </div>

            {!editUser && (
              <div className="rounded-2xl border border-[#E5E7EF] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#30354A]">
                      Invitation preview
                    </p>
                    <p className="mt-1 text-xs text-[#8A8FA5]">
                      The recipient will see the organization,
                      role and assigned workspace access before
                      accepting.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={onTogglePermissionView}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#DDE0EA] bg-white px-3 text-xs font-semibold text-[#555B72] hover:bg-[#F7F8FC]"
                  >
                    <Eye size={14} />
                    {viewPermissions
                      ? "Hide preview"
                      : "Preview access"}
                  </button>
                </div>

                {viewPermissions && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EF] bg-[#F8FAFC]">
                    <div className="border-b border-[#E5E7EF] bg-white px-4 py-4">
                      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                        Ziya FOS invitation
                      </p>
                      <p className="mt-2 text-base font-bold text-[#20243A]">
                        {form.name.trim()
                          ? `Welcome to Ziya FOS, ${form.name
                              .trim()
                              .split(/\s+/)[0]}`
                          : "Welcome to Ziya FOS"}
                      </p>
                      <p className="mt-1 text-xs text-[#73798D]">
                        You have been invited to join this
                        organization's financial workspace.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                      <PreviewBlock
                        label="Organization role"
                        value={roleLabel(form.role)}
                      />
                      <PreviewBlock
                        label="Invitation expiry"
                        value="72 hours"
                      />
                      <PreviewBlock
                        label="Recipient"
                        value={
                          form.email.trim() ||
                          "Recipient email"
                        }
                      />
                      <PreviewBlock
                        label="Access"
                        value={`${selectedPermissionCount} permissions`}
                      />
                    </div>

                    <div className="border-t border-[#E5E7EF] px-4 py-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                        Included capabilities
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPermissionList
                          .slice(0, 12)
                          .map((permission) => (
                            <span
                              key={permission}
                              className="rounded-full border border-[#DDE0EA] bg-white px-2.5 py-1 text-[10px] font-medium text-[#555B72]"
                            >
                              {permissionLabel(
                                permission,
                              )}
                            </span>
                          ))}
                        {selectedPermissionList.length >
                          12 && (
                          <span className="rounded-full bg-[#EEF0F5] px-2.5 py-1 text-[10px] font-semibold text-[#656B80]">
                            +
                            {selectedPermissionList.length -
                              12}{" "}
                            more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3.5">
              <div className="flex items-start gap-3">
                <Shield
                  size={16}
                  className="mt-0.5 shrink-0 text-blue-700"
                />
                <div>
                  <p className="text-xs font-semibold text-blue-900">
                    Access is enforced server-side
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-blue-800/80">
                    The selected role and permissions control
                    what this person can access in the financial
                    workspace. The invitation itself does not
                    grant access until it is accepted.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#E7E9F0] bg-[#FAFBFD] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-[#DDE0EA] bg-white px-5 text-xs font-semibold text-[#555B72] transition hover:bg-[#F4F5F9]"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={
              saving ||
              !form.name.trim() ||
              !form.email.trim() ||
              !form.role ||
              (form.role === "CUSTOM" &&
                form.permissions.length === 0)
            }
            onClick={onSubmit}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#20243A] px-5 text-xs font-semibold text-white transition hover:bg-[#171A2C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving && (
              <RefreshCw
                size={14}
                className="animate-spin"
              />
            )}
            {editUser
              ? "Save access changes"
              : "Send invitation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmOrDetailModal({
  modal,
  saving,
  onClose,
  onDeactivate,
  onRemove,
  onRevoke,
}: {
  modal: Exclude<ModalState, { type: "none" }>;
  saving: boolean;
  onClose: () => void;
  onDeactivate: (user: User) => void;
  onRemove: (user: User) => void;
  onRevoke: (invitation: Invitation) => void;
}) {
  if (modal.type === "viewInvitation") {
    const permissions = modal.invitation.permissions;

    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111526]/55 p-4 backdrop-blur-[2px]"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_24px_80px_rgba(20,24,40,0.25)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="access-detail-title"
          onMouseDown={(event) =>
            event.stopPropagation()
          }
        >
          <div className="flex items-start justify-between border-b border-[#E7E9F0] px-6 py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9297AA]">
                Access details
              </p>
              <h2
                id="access-detail-title"
                className="mt-1 text-xl font-bold text-[#20243A]"
              >
                {roleLabel(modal.invitation.role)}
              </h2>
              <p className="mt-1 text-xs text-[#7B8094]">
                {modal.invitation.email}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#777C91] hover:bg-[#F4F5F9]"
              aria-label="Close access details"
            >
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[65vh] overflow-y-auto px-6 py-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PreviewBlock
                label="Role"
                value={roleLabel(
                  modal.invitation.role,
                )}
              />
              <PreviewBlock
                label="Status"
                value={invitationState(modal.invitation)}
              />
              <PreviewBlock
                label="Sent"
                value={formatDateTime(
                  modal.invitation.createdAt,
                )}
              />
              <PreviewBlock
                label="Expires"
                value={
                  modal.invitation.expiresAt
                    ? formatDateTime(
                        modal.invitation
                          .expiresAt,
                      )
                    : "Not applicable"
                }
              />
            </div>

            <div className="mt-5 rounded-2xl border border-[#E5E7EF] bg-[#F9FAFC] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#30354A]">
                    Permissions
                  </p>
                  <p className="mt-1 text-xs text-[#8A8FA5]">
                    Exact capabilities assigned to this
                    organization membership or invitation.
                  </p>
                </div>

                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#555B72] ring-1 ring-[#E5E7EF]">
                  {permissions.includes("*")
                    ? "Full access"
                    : `${permissions.length} permissions`}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {permissions.includes("*") ? (
                  <div className="col-span-full rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
                    Full organization permissions are
                    assigned.
                  </div>
                ) : (
                  permissions.map((permission) => (
                    <div
                      key={permission}
                      className="flex items-center gap-2.5 rounded-xl border border-[#ECEEF4] bg-white px-3 py-2.5"
                    >
                      <Check
                        size={14}
                        className="shrink-0 text-emerald-500"
                      />
                      <span className="text-xs text-[#555B72]">
                        {permissionLabel(
                          permission,
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-[#E7E9F0] bg-[#FAFBFD] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl bg-[#20243A] px-5 text-xs font-semibold text-white hover:bg-[#171A2C]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  let title = "";
  let description = "";
  let confirmLabel = "";
  let destructive = false;
  let action: () => void = () => undefined;

  if (modal.type === "deactivate") {
    const activating =
      !modal.user.membershipActive;

    title = activating
      ? "Restore organization access?"
      : "Disable organization access?";
    description = activating
      ? `${modal.user.name} will regain access to this organization's FOS workspace using their existing role and permissions.`
      : `${modal.user.name} will no longer be able to access this organization's FOS workspace. Their membership and permission configuration will be retained.`;
    confirmLabel = activating
      ? "Restore access"
      : "Disable access";
    action = () => void onDeactivate(modal.user);
    destructive = !activating;
  }

  if (modal.type === "remove") {
    title = "Remove user from organization?";
    description = `${modal.user.name} will lose membership in this organization. This does not delete their underlying account.`;
    confirmLabel = "Remove user";
    action = () => void onRemove(modal.user);
    destructive = true;
  }

  if (modal.type === "revoke") {
    title = "Revoke invitation?";
    description = `The invitation sent to ${modal.invitation.email} will no longer be usable. A new invitation can be issued later.`;
    confirmLabel = "Revoke invitation";
    action = () =>
      void onRevoke(modal.invitation);
    destructive = true;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#111526]/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_24px_80px_rgba(20,24,40,0.25)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="px-6 py-6">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${
              destructive
                ? "bg-red-50 text-red-600"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {destructive ? (
              <Trash2 size={19} />
            ) : (
              <UserCheck size={19} />
            )}
          </div>

          <h2
            id="confirmation-title"
            className="mt-5 text-lg font-bold text-[#20243A]"
          >
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#6F758B]">
            {description}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#E7E9F0] bg-[#FAFBFD] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-xl border border-[#DDE0EA] bg-white px-5 text-xs font-semibold text-[#555B72] hover:bg-[#F4F5F9] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={action}
            disabled={saving}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-xs font-semibold text-white disabled:opacity-50 ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#20243A] hover:bg-[#171A2C]"
            }`}
          >
            {saving && (
              <RefreshCw
                size={14}
                className="animate-spin"
              />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold text-[#454A60]">
        {label}
        {hint && (
          <span className="ml-1 font-normal text-[#9A9EAF]">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function PreviewBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#ECEEF4] bg-white px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[#9297AA]">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-[#454A60]">
        {value}
      </p>
    </div>
  );
}
