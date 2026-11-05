import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRows, useSaveRow } from "@/lib/db";
import { today, dateFmt } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserPlus, UserMinus, ArrowRightLeft, History, Info, Check, Shield } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export type TeamMember = {
  id: string;
  team_id: string;
  employee_id: string;
  effective_from: string;
  left_on: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at?: string;
};

interface TeamManagementDialogProps {
  teams: Array<{ id: string; name: string; leader_employee_id?: string | null; leader_name?: string | null }>;
  employees: Array<{ id: string; full_name: string; employee_code?: string; team_id?: string | null; status?: string }>;
  projects?: Array<{ id: string; name: string }>;
  canManage: boolean;
}

export function TeamManagementDialog({
  teams,
  employees,
  projects = [],
  canManage,
}: TeamManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // New Team Form State
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamLeaderId, setNewTeamLeaderId] = useState("");

  // Edit Team State
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamLeaderId, setEditTeamLeaderId] = useState("");

  // Member Management State
  const [addEmpId, setAddEmpId] = useState("");
  const [addEffectiveFrom, setAddEffectiveFrom] = useState(today());

  // Replace Member State
  const [replaceOldEmpId, setReplaceOldEmpId] = useState("");
  const [replaceNewEmpId, setReplaceNewEmpId] = useState("");
  const [replaceDate, setReplaceDate] = useState(today());
  const [replaceReason, setReplaceReason] = useState("Absent replacement");

  // Remove Member State
  const [removeEmpId, setRemoveEmpId] = useState("");
  const [removeDate, setRemoveDate] = useState(today());

  const qc = useQueryClient();
  const teamMembersQuery = useRows<TeamMember>("team_members", {
    order: { col: "effective_from", asc: false },
    limit: 1000,
  });

  const saveTeam = useSaveRow("teams", "Team");

  // Currently selected team object
  const currentTeam = useMemo(() => {
    return teams.find((t) => t.id === selectedTeamId);
  }, [teams, selectedTeamId]);

  // When selected team changes, sync edit form
  const handleSelectTeam = (tId: string) => {
    setSelectedTeamId(tId);
    const t = teams.find((item) => item.id === tId);
    if (t) {
      setEditTeamName(t.name);
      setEditTeamLeaderId(t.leader_employee_id || "");
    }
  };

  // Filter team members for selected team
  const currentTeamMembers = useMemo(() => {
    if (!selectedTeamId) return [];
    return (teamMembersQuery.data ?? []).filter((tm) => tm.team_id === selectedTeamId);
  }, [teamMembersQuery.data, selectedTeamId]);

  // Active members in the selected team
  const activeMembers = useMemo(() => {
    return currentTeamMembers.filter((tm) => tm.is_active && !tm.left_on);
  }, [currentTeamMembers]);

  // Past / inactive members
  const pastMembers = useMemo(() => {
    return currentTeamMembers.filter((tm) => !tm.is_active || tm.left_on);
  }, [currentTeamMembers]);

  const empName = (id: string) => {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.full_name} (${e.employee_code || "Labour"})` : "Unknown Worker";
  };

  // 1. Create Team
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      toast.error("Please enter a team name.");
      return;
    }
    try {
      const leader = employees.find((e) => e.id === newTeamLeaderId);
      const res = await (supabase as any).from("teams").insert({
        name: newTeamName.trim(),
        leader_employee_id: newTeamLeaderId || null,
        leader_name: leader?.full_name || null,
      }).select().single();

      if (res.error) throw res.error;
      toast.success(`Team "${newTeamName}" created.`);
      qc.invalidateQueries({ queryKey: ["teams"] });
      setNewTeamName("");
      setNewTeamLeaderId("");
      if (res.data) setSelectedTeamId(res.data.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to create team.");
    }
  };

  // 2. Update Team Name / Leader
  const handleUpdateTeam = async () => {
    if (!selectedTeamId || !editTeamName.trim()) return;
    try {
      const leader = employees.find((e) => e.id === editTeamLeaderId);
      const res = await (supabase as any).from("teams").update({
        name: editTeamName.trim(),
        leader_employee_id: editTeamLeaderId || null,
        leader_name: leader?.full_name || null,
      }).eq("id", selectedTeamId);

      if (res.error) throw res.error;
      toast.success("Team details updated.");
      qc.invalidateQueries({ queryKey: ["teams"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update team.");
    }
  };

  // 3. Add Member
  const handleAddMember = async () => {
    if (!selectedTeamId || !addEmpId) {
      toast.error("Please select an employee.");
      return;
    }
    try {
      const res = await (supabase as any).from("team_members").insert({
        team_id: selectedTeamId,
        employee_id: addEmpId,
        effective_from: addEffectiveFrom,
        is_active: true,
      });
      if (res.error) throw res.error;

      // Also sync current employee team_id
      await (supabase as any).from("employees").update({ team_id: selectedTeamId }).eq("id", addEmpId);

      toast.success("Member added to team.");
      qc.invalidateQueries({ queryKey: ["team_members"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees_view"] });
      setAddEmpId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add member.");
    }
  };

  // 4. Replace Member (Atomic replacement with effective date)
  const handleReplaceMember = async () => {
    if (!selectedTeamId || !replaceOldEmpId || !replaceNewEmpId) {
      toast.error("Please select both the worker to replace and the replacement worker.");
      return;
    }
    if (replaceOldEmpId === replaceNewEmpId) {
      toast.error("Cannot replace a worker with themselves.");
      return;
    }

    try {
      // Step A: Mark old member as left on replaceDate
      const updateOld = await (supabase as any)
        .from("team_members")
        .update({
          left_on: replaceDate,
          is_active: false,
          notes: `Replaced by ${empName(replaceNewEmpId)}: ${replaceReason}`,
        })
        .eq("team_id", selectedTeamId)
        .eq("employee_id", replaceOldEmpId)
        .is("left_on", null);

      if (updateOld.error) throw updateOld.error;

      // Step B: Insert new member starting on replaceDate
      const insertNew = await (supabase as any).from("team_members").insert({
        team_id: selectedTeamId,
        employee_id: replaceNewEmpId,
        effective_from: replaceDate,
        is_active: true,
        notes: `Replacement for ${empName(replaceOldEmpId)}: ${replaceReason}`,
      });

      if (insertNew.error) throw insertNew.error;

      // Step C: Sync employees table active team_id
      await (supabase as any).from("employees").update({ team_id: selectedTeamId }).eq("id", replaceNewEmpId);

      toast.success(
        `Successfully replaced ${empName(replaceOldEmpId)} with ${empName(replaceNewEmpId)} effective from ${dateFmt(
          replaceDate
        )}.`
      );
      qc.invalidateQueries({ queryKey: ["team_members"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees_view"] });
      qc.invalidateQueries({ queryKey: ["attendance_view"] });
      setReplaceOldEmpId("");
      setReplaceNewEmpId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to replace member.");
    }
  };

  // 5. Remove Member (leaves team without deleting worker or past attendance)
  const handleRemoveMember = async () => {
    if (!selectedTeamId || !removeEmpId) return;
    try {
      const res = await (supabase as any)
        .from("team_members")
        .update({
          left_on: removeDate,
          is_active: false,
          notes: `Removed on ${removeDate}`,
        })
        .eq("team_id", selectedTeamId)
        .eq("employee_id", removeEmpId)
        .is("left_on", null);

      if (res.error) throw res.error;

      // Update employee team_id to null
      await (supabase as any).from("employees").update({ team_id: null }).eq("id", removeEmpId);

      toast.success("Member removed from team. Past attendance remains preserved.");
      qc.invalidateQueries({ queryKey: ["team_members"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees_view"] });
      setRemoveEmpId("");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member.");
    }
  };

  // 6. Toggle Inactive / Active (for temporary absence)
  const handleToggleActive = async (member: TeamMember) => {
    try {
      const nextActive = !member.is_active;
      const res = await (supabase as any)
        .from("team_members")
        .update({ is_active: nextActive })
        .eq("id", member.id);

      if (res.error) throw res.error;
      toast.success(nextActive ? "Worker marked as Active." : "Worker marked as Inactive (Absent).");
      qc.invalidateQueries({ queryKey: ["team_members"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs font-semibold">
          <Users className="size-3.5 text-primary" />
          <span>Manage Teams &amp; Rosters</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Users className="size-5 text-primary" />
            <span>Team Management &amp; Worker Replacement</span>
          </DialogTitle>
          <div className="flex items-center gap-1.5 rounded-md bg-blue-500/10 p-2.5 text-xs text-blue-900 dark:text-blue-200 border border-blue-500/20">
            <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              <b>Preserves Attendance History:</b> Replacing or removing a worker uses effective dates. Past attendance
              and wages for absent workers (like Vinoth) remain historically preserved in old weeks!
            </span>
          </div>
        </DialogHeader>

        <Tabs defaultValue="manage" className="pt-2">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="manage" className="text-xs">
              Manage Existing Team
            </TabsTrigger>
            <TabsTrigger value="replace" className="text-xs">
              Replace Absent Worker
            </TabsTrigger>
            <TabsTrigger value="create" className="text-xs">
              Create New Team
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MANAGE EXISTING TEAM */}
          <TabsContent value="manage" className="space-y-4 pt-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Select Team</Label>
              <Select value={selectedTeamId} onValueChange={handleSelectTeam}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choose a team to edit..." />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.name} {t.leader_name ? `(Lead: ${t.leader_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentTeam && (
              <div className="space-y-4 rounded-lg border p-3 bg-muted/20">
                {/* Team Details Edit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Team Name</Label>
                    <Input
                      value={editTeamName}
                      onChange={(e) => setEditTeamName(e.target.value)}
                      className="h-8 text-xs"
                      disabled={!canManage}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Team Leader / Supervisor</Label>
                    <Select value={editTeamLeaderId} onValueChange={setEditTeamLeaderId} disabled={!canManage}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select leader" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id} className="text-xs">
                            {e.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {canManage && (
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={handleUpdateTeam} className="h-7 text-xs">
                      Save Team Details
                    </Button>
                  </div>
                )}

                {/* Active Members Roster */}
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">
                      Active Members ({activeMembers.length})
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-md border divide-y divide-border/60 bg-background text-xs">
                    {activeMembers.map((tm) => (
                      <div key={tm.id} className="flex items-center justify-between p-2">
                        <div>
                          <div className="font-medium text-foreground">{empName(tm.employee_id)}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Member since: {dateFmt(tm.effective_from)}
                            {tm.notes ? ` • ${tm.notes}` : ""}
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(tm)}
                              className="h-6 px-2 text-[10px]"
                            >
                              {tm.is_active ? "Mark Absent/Inactive" : "Re-activate"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setRemoveEmpId(tm.employee_id);
                                handleRemoveMember();
                              }}
                              className="h-6 px-2 text-[10px] text-destructive hover:text-destructive"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    {activeMembers.length === 0 && (
                      <div className="p-4 text-center text-muted-foreground text-xs">
                        No active members in this team.
                      </div>
                    )}
                  </div>
                </div>

                {/* Add Member Row */}
                {canManage && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t pt-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Add Worker to Team</Label>
                      <Select value={addEmpId} onValueChange={setAddEmpId}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choose worker..." />
                        </SelectTrigger>
                        <SelectContent>
                          {employees
                            .filter((e) => !activeMembers.some((m) => m.employee_id === e.id))
                            .map((e) => (
                              <SelectItem key={e.id} value={e.id} className="text-xs">
                                {e.full_name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px]">Effective From Date</Label>
                      <Input
                        type="date"
                        value={addEffectiveFrom}
                        onChange={(e) => setAddEffectiveFrom(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>

                    <Button type="button" size="sm" onClick={handleAddMember} className="h-8 text-xs gap-1">
                      <UserPlus className="size-3.5" />
                      <span>Add Member</span>
                    </Button>
                  </div>
                )}

                {/* Membership History */}
                {pastMembers.length > 0 && (
                  <div className="space-y-1.5 border-t pt-3">
                    <span className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
                      <History className="size-3.5" />
                      <span>Membership History / Past Members ({pastMembers.length})</span>
                    </span>
                    <div className="max-h-36 overflow-y-auto rounded-md border divide-y divide-border/40 text-[11px] bg-muted/20">
                      {pastMembers.map((pm) => (
                        <div key={pm.id} className="p-2 flex items-center justify-between text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">{empName(pm.employee_id)}</span>
                            <span className="ml-2 text-[10px]">
                              ({dateFmt(pm.effective_from)} &rarr; {pm.left_on ? dateFmt(pm.left_on) : "Present"})
                            </span>
                            {pm.notes && <div className="text-[10px] italic">{pm.notes}</div>}
                          </div>
                          {!pm.is_active && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1 text-amber-600 border-amber-500/30">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: REPLACE ABSENT WORKER (VINOTH WORKFLOW) */}
          <TabsContent value="replace" className="space-y-4 pt-3">
            <div className="rounded-md border p-3 bg-amber-500/10 border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
              <div className="font-semibold pb-1">One-Click Worker Replacement:</div>
              <div>
                When a worker is absent or leaves (e.g. Vinoth absent for weeks), select them below and assign a replacement
                helper. His past attendance records will stay 100% frozen, and the new helper will join the weekly grid starting
                from the replacement date.
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Team <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedTeamId} onValueChange={handleSelectTeam}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Effective Replacement Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={replaceDate}
                  onChange={(e) => setReplaceDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-destructive flex items-center gap-1">
                  <UserMinus className="size-3.5" />
                  <span>Absent / Leaving Worker</span>
                </Label>
                <Select value={replaceOldEmpId} onValueChange={setReplaceOldEmpId} disabled={!selectedTeamId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select absent worker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMembers.map((m) => (
                      <SelectItem key={m.employee_id} value={m.employee_id} className="text-xs">
                        {empName(m.employee_id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <UserPlus className="size-3.5" />
                  <span>Replacement Helper / Worker</span>
                </Label>
                <Select value={replaceNewEmpId} onValueChange={setReplaceNewEmpId} disabled={!selectedTeamId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select replacement helper..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees
                      .filter((e) => !activeMembers.some((m) => m.employee_id === e.id))
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id} className="text-xs">
                          {e.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reason / Handover Note</Label>
              <Input
                value={replaceReason}
                onChange={(e) => setReplaceReason(e.target.value)}
                placeholder="e.g. Absent continuously since last week, replaced with helper"
                className="h-8 text-xs"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleReplaceMember}
                disabled={!canManage || !selectedTeamId || !replaceOldEmpId || !replaceNewEmpId}
                className="text-xs font-semibold gap-1.5"
              >
                <ArrowRightLeft className="size-3.5" />
                <span>Confirm Replacement</span>
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: CREATE NEW TEAM */}
          <TabsContent value="create" className="space-y-4 pt-3">
            <form onSubmit={handleCreateTeam} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Team Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Ramesh Team (Kolar Site)"
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Team Leader / Supervisor (Optional)</Label>
                <Select value={newTeamLeaderId} onValueChange={setNewTeamLeaderId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Choose a leader..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id} className="text-xs">
                        {e.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" disabled={!canManage || !newTeamName.trim()} className="text-xs">
                  Create Team
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
