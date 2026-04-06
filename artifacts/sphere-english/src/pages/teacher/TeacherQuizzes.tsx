import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Button, Input, Label, Badge, Modal } from "@/components/ui/core";
import { useToast } from "@/hooks/use-toast";
import {
  FileQuestion, Plus, Trash2, Eye, CheckCircle2, XCircle, UserPlus, X,
} from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { abbrevName } from "@/lib/utils";

const questionSchema = z.object({
  type: z.enum(["multiple_choice", "true_false", "fill_blank"]),
  question: z.string().min(3, "Soru metni zorunludur"),
  options: z.string().optional(),
  correctAnswer: z.string().min(1, "Doğru cevap zorunludur"),
  points: z.coerce.number().min(1).default(10),
});

const quizSchema = z.object({
  title: z.string().min(2, "Başlık zorunludur"),
  timeLimit: z.coerce.number().optional(),
  passingScore: z.coerce.number().min(0).max(100).default(70),
  questions: z.array(questionSchema),
});
type QuizForm = z.infer<typeof quizSchema>;

interface Quiz {
  id: number;
  title: string;
  level?: string | null;
  timeLimit: number | null;
  passingScore: number;
  questionsCount: number;
  attemptsCount: number;
  createdAt: string;
}

interface Attempt {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  score: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

interface Student {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  currentLevel?: string | null;
  studentNumber?: string | null;
}

interface Assignment {
  id: number;
  studentId: number;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string;
  dueDate: string | null;
  assignedAt: string;
}

const QUESTION_TYPES = [
  { value: "multiple_choice", label: "Çoktan Seçmeli" },
  { value: "true_false", label: "Doğru / Yanlış" },
  { value: "fill_blank", label: "Boşluk Doldurma" },
];

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (!res.ok) { const e = await res.json().catch(() => ({ error: "Hata" })); throw new Error(e.error || "Hata"); }
  return res.json();
}

function QuestionEditor({ control, register, errors, index, watch, remove }: any) {
  const type = watch(`questions.${index}.type`);
  return (
    <div className="border-2 border-border rounded-xl p-4 space-y-3 bg-secondary/20">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">Soru {index + 1}</span>
        <button type="button" onClick={() => remove(index)} className="text-destructive hover:text-destructive/80 text-xs">Sil</button>
      </div>
      <div>
        <Label>Tür</Label>
        <select {...register(`questions.${index}.type`)}
          className="flex h-10 w-full rounded-lg border-2 border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
          {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <Label>Soru Metni</Label>
        <Input {...register(`questions.${index}.question`)} placeholder="Soru..." />
        {errors?.questions?.[index]?.question && <p className="text-xs text-destructive mt-1">{errors.questions[index].question.message}</p>}
      </div>
      {type === "multiple_choice" && (
        <div>
          <Label>Seçenekler (virgülle ayırın)</Label>
          <Input {...register(`questions.${index}.options`)} placeholder="A, B, C, D" />
        </div>
      )}
      {type === "true_false" && (
        <div>
          <Label>Doğru Cevap</Label>
          <select {...register(`questions.${index}.correctAnswer`)}
            className="flex h-10 w-full rounded-lg border-2 border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
            <option value="true">Doğru</option>
            <option value="false">Yanlış</option>
          </select>
        </div>
      )}
      {type !== "true_false" && (
        <div>
          <Label>Doğru Cevap</Label>
          <Input {...register(`questions.${index}.correctAnswer`)} placeholder="Doğru cevabı girin" />
          {errors?.questions?.[index]?.correctAnswer && <p className="text-xs text-destructive mt-1">{errors.questions[index].correctAnswer.message}</p>}
        </div>
      )}
      <div>
        <Label>Puan</Label>
        <Input type="number" min="1" {...register(`questions.${index}.points`)} className="w-24" />
      </div>
    </div>
  );
}

export default function TeacherQuizzes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [attemptsQuiz, setAttemptsQuiz] = useState<Quiz | null>(null);
  const [assignQuiz, setAssignQuiz] = useState<Quiz | null>(null);
  const [assignmentsQuiz, setAssignmentsQuiz] = useState<Quiz | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");

  const { data: quizzes = [], isLoading } = useQuery<Quiz[]>({
    queryKey: ["/api/teacher/quizzes"],
    queryFn: () => apiFetch("/api/teacher/quizzes"),
  });

  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ["/api/teacher/students"],
    queryFn: () => apiFetch("/api/teacher/students"),
    enabled: !!assignQuiz,
  });

  const { data: attempts = [], isLoading: loadingAttempts } = useQuery<Attempt[]>({
    queryKey: ["/api/teacher/quizzes", attemptsQuiz?.id, "attempts"],
    queryFn: () => apiFetch(`/api/teacher/quizzes/${attemptsQuiz!.id}/attempts`),
    enabled: !!attemptsQuiz,
  });

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<Assignment[]>({
    queryKey: ["/api/teacher/quizzes", assignmentsQuiz?.id, "assignments"],
    queryFn: () => apiFetch(`/api/teacher/quizzes/${assignmentsQuiz!.id}/assignments`),
    enabled: !!assignmentsQuiz,
  });

  const createMutation = useMutation({
    mutationFn: (data: QuizForm) => {
      const payload = {
        ...data,
        questions: data.questions.map((q) => ({
          ...q,
          options: q.type === "multiple_choice" && q.options
            ? q.options.split(",").map((s) => s.trim())
            : null,
        })),
      };
      return apiFetch("/api/teacher/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/quizzes"] });
      toast({ title: "Quiz oluşturuldu!" });
      setIsCreateOpen(false);
      reset();
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/teacher/quizzes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/quizzes"] });
      toast({ title: "Quiz silindi" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ quizId, studentId, dueDate }: { quizId: number; studentId: number; dueDate?: string }) =>
      apiFetch("/api/teacher/quiz-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, studentId, dueDate: dueDate || null }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/quizzes", assignQuiz?.id, "assignments"] });
      toast({ title: "Quiz atandı!", description: "Öğrenci artık bu quizi görecek." });
      setSelectedStudentId(null);
      setDueDate("");
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/teacher/quiz-assignments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/quizzes", assignmentsQuiz?.id, "assignments"] });
      toast({ title: "Atama kaldırıldı" });
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<QuizForm>({
    resolver: zodResolver(quizSchema),
    defaultValues: { passingScore: 70, questions: [{ type: "multiple_choice", question: "", correctAnswer: "", points: 10 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "questions" });

  const handleAssign = () => {
    if (!assignQuiz || !selectedStudentId) return;
    assignMutation.mutate({ quizId: assignQuiz.id, studentId: selectedStudentId, dueDate });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display">Quiz Yönetimi</h2>
          <p className="text-muted-foreground text-sm mt-1">{quizzes.length} quiz oluşturuldu</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> Yeni Quiz
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : quizzes.length === 0 ? (
        <Card className="p-12 text-center">
          <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground font-medium">Henüz quiz oluşturmadınız</p>
          <p className="text-sm text-muted-foreground mt-1">İlk quizi oluşturmak için "Yeni Quiz" butonuna tıklayın.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quizzes.map((quiz, i) => (
            <motion.div key={quiz.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="p-5 border-2 border-border hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileQuestion className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold line-clamp-1">{quiz.title}</h3>
                      <p className="text-xs text-muted-foreground">{new Date(quiz.createdAt).toLocaleDateString("tr-TR")}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setAssignQuiz(quiz)}
                      className="p-2 rounded-lg hover:bg-primary/10 transition-colors"
                      title="Öğrenciye ata">
                      <UserPlus className="h-4 w-4 text-primary" />
                    </button>
                    <button
                      onClick={() => { setAssignmentsQuiz(quiz); }}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                      title="Atamaları gör">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { if (confirm("Bu quizi silmek istediğinize emin misiniz?")) deleteMutation.mutate(quiz.id); }}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Sil">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{quiz.questionsCount} soru</Badge>
                  <Badge variant="outline">{quiz.attemptsCount} deneme</Badge>
                  <Badge variant="outline">Geçme: {quiz.passingScore}%</Badge>
                  {quiz.timeLimit && <Badge variant="outline">{quiz.timeLimit} dk</Badge>}
                  {quiz.level && <Badge variant="secondary">{quiz.level}</Badge>}
                </div>
                <button
                  onClick={() => setAssignQuiz(quiz)}
                  className="mt-3 w-full text-sm font-medium text-primary border-2 border-primary/20 hover:border-primary/60 hover:bg-primary/5 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-2">
                  <UserPlus className="h-3.5 w-3.5" /> Öğrenciye Ata
                </button>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Quiz Oluşturma Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); reset(); }} title="Yeni Quiz Oluştur">
        <form onSubmit={handleSubmit((d) => createMutation.mutateAsync(d))} className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            <div>
              <Label>Quiz Başlığı <span className="text-destructive">*</span></Label>
              <Input {...register("title")} placeholder="Örnek: Unit 3 Vocabulary Quiz" />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Süre Limiti (dk)</Label>
                <Input type="number" min="1" {...register("timeLimit")} placeholder="Limitsiz" />
              </div>
              <div>
                <Label>Geçme Puanı (%)</Label>
                <Input type="number" min="0" max="100" {...register("passingScore")} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Sorular ({fields.length})</p>
                <button type="button"
                  onClick={() => append({ type: "multiple_choice", question: "", correctAnswer: "", points: 10 })}
                  className="text-sm text-primary hover:underline flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Soru Ekle
                </button>
              </div>
              {fields.map((field, i) => (
                <QuestionEditor key={field.id} control={control} register={register} errors={errors} index={i} watch={watch} remove={remove} />
              ))}
              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">En az 1 soru ekleyin.</p>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { setIsCreateOpen(false); reset(); }}>İptal</Button>
            <Button type="submit" className="flex-1" isLoading={createMutation.isPending}
              disabled={fields.length === 0}>Oluştur</Button>
          </div>
        </form>
      </Modal>

      {/* Quiz Atama Modal */}
      <Modal
        isOpen={!!assignQuiz}
        onClose={() => { setAssignQuiz(null); setSelectedStudentId(null); setDueDate(""); }}
        title={`Quiz Ata: ${assignQuiz?.title}`}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Bu quizi bir öğrenciye atayın. Öğrenci sınav sayfasında bu quizi görecek.</p>

          <div>
            <Label>Öğrenci Seç</Label>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Grubunuzda henüz öğrenci yok.</p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-2 mt-2 pr-1">
                {students.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-colors ${
                      selectedStudentId === s.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {(s.firstName?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{abbrevName(s.firstName, s.lastName)}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    {s.currentLevel && <Badge variant="outline" className="text-xs shrink-0">{s.currentLevel}</Badge>}
                    {selectedStudentId === s.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Son Tarih (İsteğe bağlı)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { setAssignQuiz(null); setSelectedStudentId(null); setDueDate(""); }}>
              İptal
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!selectedStudentId}
              isLoading={assignMutation.isPending}
              onClick={handleAssign}>
              Ata
            </Button>
          </div>
        </div>
      </Modal>

      {/* Atamalar Modal */}
      <Modal
        isOpen={!!assignmentsQuiz}
        onClose={() => setAssignmentsQuiz(null)}
        title={`Atamalar: ${assignmentsQuiz?.title}`}>
        {loadingAssignments ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Bu quiz henüz kimseye atanmamış.</p>
            <button
              onClick={() => { setAssignmentsQuiz(null); setAssignQuiz(assignmentsQuiz); }}
              className="mt-3 text-sm text-primary hover:underline flex items-center gap-1 mx-auto">
              <UserPlus className="h-3.5 w-3.5" /> Şimdi Ata
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-secondary/40">
                <div>
                  <p className="text-sm font-medium">{abbrevName(a.studentFirstName, a.studentLastName)}</p>
                  <p className="text-xs text-muted-foreground">{a.studentEmail}</p>
                  {a.dueDate && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Son: {new Date(a.dueDate).toLocaleDateString("tr-TR")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { if (confirm("Atamayı kaldırmak istediğinize emin misiniz?")) removeAssignmentMutation.mutate(a.id); }}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  title="Atamayı kaldır">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
