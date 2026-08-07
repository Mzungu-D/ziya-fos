import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import OrganizationCard from "../components/OrganizationCard";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import CreateOrganizationModal from "../components/CreateOrganizationModal";

import {
  getOrganizations,
} from "../../services/platformOrganizations";

import type {
  Organization,
} from "../../services/platformOrganizations";

export default function Organizations() {

  const [organizations, setOrganizations] =
    useState<Organization[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  async function loadOrganizations() {

    try {

      setLoading(true);

      const response =
        await getOrganizations();

      setOrganizations(
        response.organizations ?? []
      );

    } catch (error) {

      console.error(
        "Failed to load organizations",
        error
      );

    } finally {

      setLoading(false);

    }

  }

  const filteredOrganizations =
    useMemo(() => {

      return organizations.filter(
        (organization) =>
          organization.name
            .toLowerCase()
            .includes(
              search.toLowerCase()
            )
      );

    }, [organizations, search]);

  const totalOrganizations =
    organizations.length;

  const activeOrganizations =
    organizations.filter(
      (organization) =>
        organization.status === "ACTIVE"
    ).length;

  const pendingOrganizations =
    organizations.filter(
      (organization) =>
        organization.status === "PENDING"
    ).length;

  const suspendedOrganizations =
    organizations.filter(
      (organization) =>
        organization.status === "SUSPENDED"
    ).length;

  return (
    <div className="space-y-6">   

       <PageHeader
        title="Organizations"
        subtitle="Manage all organizations using the Ziya Financial Operating System."
      />

      <div className="flex items-center justify-between rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

        <div className="relative w-[420px]">

          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search organizations..."
            className="h-12 w-full rounded-xl border border-[#ECECF3] bg-[#F8F9FC] pl-12 pr-4 text-sm outline-none transition focus:border-[#6D5DF6]"
          />

        </div>

        <PrimaryButton
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={18} />

          <span className="ml-2">
            New Organization
          </span>

        </PrimaryButton>

      </div>

      <div className="grid grid-cols-4 gap-5">

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <p className="text-sm text-[#666B84]">
            Total Organizations
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#20243A]">
            {totalOrganizations}
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <p className="text-sm text-[#666B84]">
            Active
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#16A34A]">
            {activeOrganizations}
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <p className="text-sm text-[#666B84]">
            Pending
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#F59E0B]">
            {pendingOrganizations}
          </h2>

        </div>

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-5 shadow-sm">

          <p className="text-sm text-[#666B84]">
            Suspended
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#EF4444]">
            {suspendedOrganizations}
          </h2>

        </div>

      </div>    

        {loading ? (

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-12 text-center shadow-sm">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#E5E7EB] border-t-[#6D5DF6]" />

          <p className="mt-5 text-[#666B84]">
            Loading organizations...
          </p>

        </div>

      ) : filteredOrganizations.length === 0 ? (

        <div className="rounded-2xl border border-[#ECECF3] bg-white p-12 text-center shadow-sm">

          <h3 className="text-lg font-semibold text-[#20243A]">
            No organizations found
          </h3>

          <p className="mt-2 text-[#666B84]">
            Try a different search or create a new organization.
          </p>

        </div>

      ) : (

        <div className="grid grid-cols-2 gap-6">

          {filteredOrganizations.map((organization) => (

            <OrganizationCard
              key={organization.id}
              id={organization.id}
              name={organization.name}
              country={organization.country}
              currency={organization.currency}
              memberCount={organization.memberCount}
              logoUrl={organization.logoUrl}
              status={organization.status}
            />

          ))}

        </div>

      )}

      <CreateOrganizationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={loadOrganizations}
      />  
        </div>
  );
}