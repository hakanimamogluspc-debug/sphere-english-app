import { useState } from "react";
import { useGetQuizzes, useGetQuiz, useSubmitQuiz } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, Badge, Button } from "@/components/ui/core";
import { FileQuestion, Clock, Target, CheckCircle, ChevronRight, ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

function QuizList({ onSelect }: { onSelect: (id: number) => void }) {
  const { data: quizzes, isLoading } = useGetQuizzes();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display">Sınavlar ve Alıştırmalar</h1>
        <p className="text-muted-foreground mt-1">Bilginizi test edin ve ilerlemenizi takip edin.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-secondary/50" />)}
        </div>
      ) : quizzes?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileQuestion className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-xl font-bold mb-2">Henüz sınav yok</h3>
            <p className="text-muted-foreground">Öğretmeniniz sınav eklediğinde burada görünecek.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes?.map(quiz => (
            <Card key={quiz.id} className="flex flex-col hover:-translate-y-1 transition-transform duration-300 cursor-pointer" onClick={() => onSelect(quiz.id)}>
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileQuestion className="h-6 w-6 text-primary" />
                  </div>
                  {(quiz as any).level ? (
                    <Badge className={`font-bold ${
                      (quiz as any).level === 'A1' ? 'bg-green-100 text-green-700 border-green-300' :
                      (quiz as any).level === 'A2' ? 'bg-teal-100 text-teal-700 border-teal-300' :
                      (quiz as any).level === 'B1' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                      (quiz as any).level === 'B2' ? 'bg-indigo-100 text-indigo-700 border-indigo-300' :
                      (quiz as any).level === 'C1' ? 'bg-purple-100 text-purple-700 border-purple-300' :
                      'bg-rose-100 text-rose-700 border-rose-300'
                    }`} variant="outline">{(quiz as any).level}</Badge>
                  ) : (
                    <Badge variant="outline">Genel</Badge>
                  )}
                </div>
                <h3 className="text-lg font-bold mb-2 font-display">{quiz.title}</h3>
                <div className="flex items-center gap-4 mt-auto pt-4 border-t border-border text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Clock size={14} /> {quiz.timeLimit ?? 15} dk</span>
                  <span className="flex items-center gap-1.5"><Target size={14} /> %{quiz.passingScore} geçme</span>
                </div>
                <Button className="mt-4 w-full" size="sm">
                  Alıştırmayı Başlat <ChevronRight size={16} className="ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function QuizTaker({ quizId, onBack }: { quizId: number; onBack: () => void }) {
  const { data: quiz, isLoading } = useGetQuiz(quizId);
  const submitMutation = useSubmitQuiz();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!quiz) return null;
  const questions = quiz.questions || [];

  const handleAnswer = (questionId: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    try {
      const answerArray = Object.entries(answers).map(([questionId, answer]) => ({
        questionId: parseInt(questionId),
        answer,
      }));
      const res = await submitMutation.mutateAsync({
        id: quizId,
        data: { answers: answerArray }
      });
      setResult(res);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
    } catch {
      toast({ title: "Hata", description: "Sınav gönderilemedi. Lütfen tekrar deneyin.", variant: "destructive" });
    }
  };

  if (submitted && result) {
    const passed = result.passed;
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={18} /> Sınavlara Dön
        </button>
        <Card className={`border-2 ${passed ? 'border-green-500' : 'border-red-400'}`}>
          <CardContent className="p-8 text-center">
            <div className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
              {passed ? (
                <CheckCircle className="h-12 w-12 text-green-600" />
              ) : (
                <Target className="h-12 w-12 text-red-500" />
              )}
            </div>
            <h2 className="text-3xl font-bold font-display mb-2">{passed ? 'Tebrikler!' : 'Pratik Yapmaya Devam!'}</h2>
            <p className="text-muted-foreground mb-6">{passed ? 'Sınavı geçtiniz!' : `Geçmek için %${quiz.passingScore} gerekiyor.`}</p>
            <div className="text-6xl font-bold font-display mb-2" style={{ color: passed ? '#16a34a' : '#dc2626' }}>
              %{result.percentage?.toFixed(0) || result.score}
            </div>
            <p className="text-muted-foreground text-sm mb-6">Puan: {result.score} / {result.totalPoints}</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={onBack} variant="outline">Sınavlara Dön</Button>
              {!passed && <Button onClick={() => { setSubmitted(false); setAnswers({}); setCurrentQ(0); }}>Tekrar Dene</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const q = questions[currentQ];
  const progress = ((currentQ + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  const questionTypeLabel: Record<string, string> = {
    multiple_choice: "Çoktan Seçmeli",
    true_false: "Doğru/Yanlış",
    fill_blank: "Boşluk Doldurma",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft size={18} /> Sınavlara Dön
      </button>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold font-display">{quiz.title}</h1>
          <span className="text-sm text-muted-foreground">{currentQ + 1} / {questions.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {q && (
        <Card>
          <CardContent className="p-8">
            <Badge className="mb-4">{questionTypeLabel[q.type] || q.type}</Badge>
            <h3 className="text-xl font-bold mb-6">{q.question}</h3>

            {(q.type === 'multiple_choice' || q.type === 'true_false') && q.options && (
              <div className="space-y-3">
                {(q.options as string[]).map((option: string) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(q.id, option)}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all font-medium ${
                      answers[q.id] === option
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-accent hover:bg-accent/5'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'fill_blank' && (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={e => handleAnswer(q.id, e.target.value)}
                placeholder="Cevabınızı yazın..."
                className="w-full px-4 py-3 border-2 border-border rounded-xl focus:outline-none focus:border-primary text-base"
              />
            )}

            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>
                Önceki
              </Button>
              {currentQ < questions.length - 1 ? (
                <Button onClick={() => setCurrentQ(currentQ + 1)} disabled={!answers[q.id]}>
                  Sonraki <ChevronRight size={16} className="ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || answeredCount < questions.length}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submitMutation.isPending ? "Gönderiliyor..." : `Sınavı Tamamla (${answeredCount}/${questions.length} cevaplandı)`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-8 gap-2">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentQ(i)}
            className={`h-8 w-8 rounded-full text-xs font-bold transition-all ${
              i === currentQ ? 'bg-primary text-white' :
              answers[questions[i]?.id] ? 'bg-green-100 text-green-700 border border-green-300' :
              'bg-secondary text-muted-foreground hover:bg-secondary/80'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Quizzes() {
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);

  if (selectedQuizId) {
    return <QuizTaker quizId={selectedQuizId} onBack={() => setSelectedQuizId(null)} />;
  }

  return <QuizList onSelect={setSelectedQuizId} />;
}
