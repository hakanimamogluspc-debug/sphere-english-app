import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seedProduction() {
  const client = await pool.connect();
  try {
    console.log('[seed] Checking quizzes...');

    const quizzesData = [
      { title: 'A1 Seviyesi - Temel Alıştırmalar', level: 'A1', timeLimit: 15, passingScore: 60 },
      { title: 'A2 Seviyesi - Temel Alıştırmalar', level: 'A2', timeLimit: 15, passingScore: 60 },
      { title: 'B1 Seviyesi - Orta Seviye Alıştırmalar', level: 'B1', timeLimit: 20, passingScore: 65 },
      { title: 'B2 Seviyesi - Orta-Üstü Alıştırmalar', level: 'B2', timeLimit: 20, passingScore: 65 },
      { title: 'C1 Seviyesi - İleri Alıştırmalar', level: 'C1', timeLimit: 25, passingScore: 70 },
      { title: 'C2 Seviyesi - Yetkinlik Alıştırmaları', level: 'C2', timeLimit: 25, passingScore: 70 },
    ];

    const questionsData = {
      A1: [
        { type: 'multiple_choice', question: 'Hello, I ___ a student at Sphere English.', options: ['is','are','am','be'], correct_answer: 'am', points: 10 },
        { type: 'multiple_choice', question: '___ your name?', options: ['Who',"What's",'Where','How'], correct_answer: "What's", points: 10 },
        { type: 'multiple_choice', question: 'She ___ in London.', options: ['live','living','lives','is live'], correct_answer: 'lives', points: 10 },
        { type: 'multiple_choice', question: 'There are two ___ on the desk.', options: ['book','books','bookes','a book'], correct_answer: 'books', points: 10 },
        { type: 'multiple_choice', question: '___ you speak English?', options: ['Do','Does','Are','Is'], correct_answer: 'Do', points: 10 },
        { type: 'multiple_choice', question: "I don't have ___ money.", options: ['some','any','a','many'], correct_answer: 'any', points: 10 },
        { type: 'multiple_choice', question: 'My brother ___ a new car.', options: ['have','having','has','is have'], correct_answer: 'has', points: 10 },
        { type: 'multiple_choice', question: 'We go to the gym ___ Tuesdays.', options: ['in','at','on','to'], correct_answer: 'on', points: 10 },
        { type: 'multiple_choice', question: 'Where ___ they from?', options: ['is','are','am','do'], correct_answer: 'are', points: 10 },
        { type: 'multiple_choice', question: 'I ___ coffee, but I love tea.', options: ["doesn't like","am not like","not like","don't like"], correct_answer: "don't like", points: 10 },
      ],
      A2: [
        { type: 'multiple_choice', question: 'Last night, we ___ to the cinema.', options: ['go','went','gone','going'], correct_answer: 'went', points: 10 },
        { type: 'multiple_choice', question: 'Is this book ___?', options: ['you','your','yours',"you're"], correct_answer: 'yours', points: 10 },
        { type: 'multiple_choice', question: 'London is ___ than Istanbul.', options: ['more expensive','expensive','most expensive','expensiver'], correct_answer: 'more expensive', points: 10 },
        { type: 'multiple_choice', question: 'I was late because I ___ my bus.', options: ['lose','lost','missed','miss'], correct_answer: 'missed', points: 10 },
        { type: 'multiple_choice', question: 'Have you ___ been to Germany?', options: ['never','ever','yet','already'], correct_answer: 'ever', points: 10 },
        { type: 'multiple_choice', question: 'I think it ___ rain tomorrow.', options: ['will','is','going to','shall'], correct_answer: 'will', points: 10 },
        { type: 'multiple_choice', question: '___ you watching TV when I called?', options: ['Did','Was','Were','Are'], correct_answer: 'Were', points: 10 },
        { type: 'multiple_choice', question: 'I enjoy ___ books in the evening.', options: ['read','to read','reading','to reading'], correct_answer: 'reading', points: 10 },
        { type: 'multiple_choice', question: 'She told me ___ wait outside.', options: ['not','to','not to','for'], correct_answer: 'not to', points: 10 },
        { type: 'multiple_choice', question: 'He ___ here for 5 years now.', options: ['works','has worked','is working','worked'], correct_answer: 'has worked', points: 10 },
      ],
      B1: [
        { type: 'multiple_choice', question: 'If I ___ you, I would apologize.', options: ['am','was','were','be'], correct_answer: 'were', points: 10 },
        { type: 'multiple_choice', question: "The letter ___ by the manager.", options: ['write','wrote','was written','is write'], correct_answer: 'was written', points: 10 },
        { type: 'multiple_choice', question: 'Despite ___ tired, she finished the project.', options: ['be','been','being','was'], correct_answer: 'being', points: 10 },
        { type: 'multiple_choice', question: "He denied ___ the money.", options: ['to take','taking','taken','take'], correct_answer: 'taking', points: 10 },
        { type: 'multiple_choice', question: 'I wish I ___ harder at school.', options: ['study','studied','had studied','have studied'], correct_answer: 'had studied', points: 10 },
        { type: 'multiple_choice', question: 'She ___ the task by noon.', options: ['will finish','will have finished','is finishing','finishes'], correct_answer: 'will have finished', points: 10 },
        { type: 'multiple_choice', question: 'The manager, ___ I spoke yesterday, is very helpful.', options: ['which','whom','who','that'], correct_answer: 'whom', points: 10 },
        { type: 'multiple_choice', question: 'They are looking forward ___ you.', options: ['to meet','meeting','to meeting','meet'], correct_answer: 'to meeting', points: 10 },
        { type: 'multiple_choice', question: 'You ___ have told me earlier!', options: ['could','should','must','might'], correct_answer: 'should', points: 10 },
        { type: 'multiple_choice', question: '___ having a degree, she lacks experience.', options: ['Despite','Although','However','Nevertheless'], correct_answer: 'Despite', points: 10 },
      ],
      B2: [
        { type: 'multiple_choice', question: 'Had she known about the meeting, she ___ attended.', options: ['would','will have','would have','had'], correct_answer: 'would have', points: 10 },
        { type: 'multiple_choice', question: 'The results were ___ surprising that everyone applauded.', options: ['such','so','very','too'], correct_answer: 'so', points: 10 },
        { type: 'multiple_choice', question: 'No sooner ___ sat down than the phone rang.', options: ['had I','I had','have I','did I'], correct_answer: 'had I', points: 10 },
        { type: 'multiple_choice', question: 'It is imperative that he ___ on time.', options: ['is','be','was','will be'], correct_answer: 'be', points: 10 },
        { type: 'multiple_choice', question: 'She ___ to resign unless conditions improve.', options: ['threatens','is threatening','threatened','has threatened'], correct_answer: 'is threatening', points: 10 },
        { type: 'multiple_choice', question: 'The proposal was turned ___ by the committee.', options: ['away','down','back','off'], correct_answer: 'down', points: 10 },
        { type: 'multiple_choice', question: 'He spoke with such ___ that everyone believed him.', options: ['conviction','convince','convinced','convincing'], correct_answer: 'conviction', points: 10 },
        { type: 'multiple_choice', question: 'The new policy is likely to ___ controversy.', options: ['provoke','evoke','invoke','revoke'], correct_answer: 'provoke', points: 10 },
        { type: 'multiple_choice', question: '___ to the latest report, sales have increased.', options: ['Referring','According','Regarding','Based'], correct_answer: 'According', points: 10 },
        { type: 'multiple_choice', question: 'The situation calls for ___ action.', options: ['urgent','urgency','urgently','urge'], correct_answer: 'urgent', points: 10 },
      ],
      C1: [
        { type: 'multiple_choice', question: 'Supposing you ___ the lottery, what would you do?', options: ['win','won','had won','would win'], correct_answer: 'won', points: 10 },
        { type: 'multiple_choice', question: "It's high time we ___ a stand against this.", options: ['take','are taking','took','should take'], correct_answer: 'took', points: 10 },
        { type: 'multiple_choice', question: 'Such ___ the fury of the storm that trees were uprooted.', options: ['was','is','had','did'], correct_answer: 'was', points: 10 },
        { type: 'multiple_choice', question: 'He acted as though he ___ the boss.', options: ['is','was','were','be'], correct_answer: 'were', points: 10 },
        { type: 'multiple_choice', question: 'Rarely ___ such a beautiful sunset.', options: ['I have seen','have I seen','saw I','I saw'], correct_answer: 'have I seen', points: 10 },
        { type: 'multiple_choice', question: 'He was ___ with a crime he did not commit.', options: ['accused','blamed','charged','arrested'], correct_answer: 'charged', points: 10 },
        { type: 'multiple_choice', question: "I'd sooner you ___ stay here tonight.", options: ['not','did not','will not','had not'], correct_answer: 'did not', points: 10 },
        { type: 'multiple_choice', question: 'She was on the ___ of resigning when she got promoted.', options: ['edge','verge','border','limit'], correct_answer: 'verge', points: 10 },
        { type: 'multiple_choice', question: 'Had it not been for your help, I ___ failed.', options: ['would have','will have','should','must have'], correct_answer: 'would have', points: 10 },
        { type: 'multiple_choice', question: "The company's reputation has been ___ by the scandal.", options: ['enhanced','tarnished','flourished','sustained'], correct_answer: 'tarnished', points: 10 },
      ],
      C2: [
        { type: 'multiple_choice', question: 'The negotiations are ___ with difficulty.', options: ['fraught','filled','laden','burdened'], correct_answer: 'fraught', points: 10 },
        { type: 'multiple_choice', question: 'Were it ___ for his intervention, the deal would have collapsed.', options: ['not','but','only','save'], correct_answer: 'not', points: 10 },
        { type: 'multiple_choice', question: 'He is a ___ of knowledge on the subject.', options: ['font','spring','well','mine'], correct_answer: 'mine', points: 10 },
        { type: 'multiple_choice', question: 'The law is ___ to many different interpretations.', options: ['vulnerable','susceptible','liable','open'], correct_answer: 'open', points: 10 },
        { type: 'multiple_choice', question: 'Try ___ he might, he could not solve the riddle.', options: ['as','although','though','even'], correct_answer: 'as', points: 10 },
        { type: 'multiple_choice', question: 'The project is in ___ until more funding is found.', options: ['limbo','abeyance','suspension','wait'], correct_answer: 'abeyance', points: 10 },
        { type: 'multiple_choice', question: 'His remarks ___ a heated debate.', options: ['sparked','kindled','triggered','all of the above'], correct_answer: 'all of the above', points: 10 },
        { type: 'multiple_choice', question: 'He is a person of ___ integrity.', options: ['impeccable','faultless','stainless','whole'], correct_answer: 'impeccable', points: 10 },
        { type: 'multiple_choice', question: 'The city is a ___ of different cultures.', options: ['melting pot','crossroads','hub','mosaic'], correct_answer: 'melting pot', points: 10 },
        { type: 'multiple_choice', question: 'Lest we ___, let us write down the plan.', options: ['forget','should forget','forgot','will forget'], correct_answer: 'should forget', points: 10 },
      ],
    };

    for (const quiz of quizzesData) {
      const existing = await client.query(
        'SELECT id FROM quizzes WHERE level = $1 LIMIT 1',
        [quiz.level]
      );
      if (existing.rows.length > 0) {
        console.log(`[seed] Quiz ${quiz.level} already exists (id=${existing.rows[0].id}), skipping.`);
        continue;
      }

      const res = await client.query(
        'INSERT INTO quizzes (title, level, time_limit, passing_score) VALUES ($1, $2, $3, $4) RETURNING id',
        [quiz.title, quiz.level, quiz.timeLimit, quiz.passingScore]
      );
      const quizId = res.rows[0].id;
      console.log(`[seed] Created quiz ${quiz.level} (id=${quizId})`);

      for (const q of questionsData[quiz.level]) {
        await client.query(
          'INSERT INTO questions (quiz_id, type, question, options, correct_answer, points) VALUES ($1, $2, $3, $4, $5, $6)',
          [quizId, q.type, q.question, JSON.stringify(q.options), q.correct_answer, q.points]
        );
      }
      console.log(`[seed] Added ${questionsData[quiz.level].length} questions for ${quiz.level}`);
    }

    console.log('[seed] Done.');
  } catch (err) {
    console.error('[seed] Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seedProduction();
