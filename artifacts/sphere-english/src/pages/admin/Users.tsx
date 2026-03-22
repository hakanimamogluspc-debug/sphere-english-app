import { useState } from "react";
import { useGetUsers, useCreateUser, useDeleteUser, useUpdateUser } from "@workspace/api-client-react";
import { Card, CardContent, Button, Input, Badge, Modal, Label } from "@/components/ui/core";
import { Search, Plus, Trash2, Edit } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";

const userSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "teacher", "student"]),
});
type UserForm = z.infer<typeof userSchema>;

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const { data: usersData, isLoading } = useGetUsers({ search });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const createMutation = useCreateUser();
  const deleteMutation = useDeleteUser();
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: "student" }
  });

  const onSubmit = async (data: UserForm) => {
    await createMutation.mutateAsync({ data });
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    setIsCreateOpen(false);
    reset();
  };

  const handleDelete = async (id: number) => {
    if(confirm("Are you sure you want to delete this user?")) {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage platform users, teachers, and admins.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus size={18} /> Add User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <Input 
              icon={<Search size={18} />} 
              placeholder="Search by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-md"
            />
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-semibold">User</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Level / Points</th>
                  <th className="px-6 py-4 font-semibold">Joined</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading users...</td></tr>
                ) : usersData?.users?.map(user => (
                  <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{user.firstName} {user.lastName}</p>
                          <p className="text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'teacher' ? 'success' : 'default'} className="capitalize">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {user.role === 'student' ? (
                        <div>
                          <p className="font-medium">{user.currentLevel || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">{user.totalPoints || 0} pts</p>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Button variant="ghost" size="icon"><Edit size={16} /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(user.id)}>
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create New User">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First Name</Label>
              <Input {...register("firstName")} />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input {...register("lastName")} />
            </div>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" {...register("email")} />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" {...register("password")} />
          </div>
          <div>
            <Label>Role</Label>
            <select {...register("role")} className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button type="submit" className="w-full mt-6" isLoading={createMutation.isPending}>Create User</Button>
        </form>
      </Modal>
    </div>
  );
}
