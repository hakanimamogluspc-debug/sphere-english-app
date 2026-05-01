import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import Header from '@/components/Header';

interface SolutionData {
  title: string;
  category: string;
  description: string;
  body: string[];
  highlights: string[];
  ctaText: string;
}

const solutions: Record<string, SolutionData> = {
  'toplanti-ingilizcesi': {
    title: 'Toplantı İngilizcesi',
    category: 'Beceriye Göre',
    description:
      'Uluslararası toplantılarda kendinizi güvenle ifade edin. Sphere English\'in Toplantı İngilizcesi programı; gündem yönetimi, görüş bildirme, soru sorma ve tartışma yönetimi gibi gerçek iş senaryolarına dayalı pratik beceriler kazandırır.',
    body: [
      'Türk iş profesyonellerinin uluslararası ortamlarda en çok zorlandığı alanların başında toplantı yönetimi gelmektedir. Sphere English\'in Toplantı İngilizcesi programı; gündem belirleme, söz alma, görüş bildirme, itiraz etme ve toplantıyı etkin biçimde kapatma becerilerini gerçek iş senaryoları üzerinden geliştirir. Program; hem yüz yüze toplantıları hem de Zoom ve Microsoft Teams gibi dijital platformlardaki sanal toplantılara özel dil kalıplarını ve iletişim stratejilerini kapsar.',
      'Araştırmalar, iş toplantılarında dil bariyerinin karar alma süreçlerini önemli ölçüde yavaşlattığını ortaya koymaktadır. Sphere English kursiyerleri, program sonunda toplantılara daha aktif katıldıklarını, fikirlerini net biçimde iletebildiklerini ve İngilizce ortamlarda öz güvenlerinin belirgin şekilde arttığını bildirmektedir. Oxford University Press iş birliğiyle hazırlanan müfredat ve yapay zeka destekli konuşma analizi, gelişimi ölçülebilir ve hızlandırılabilir kılmaktadır.',
    ],
    highlights: [
      'Toplantı açma ve kapatma kalıpları',
      'Görüş bildirme ve itiraz etme teknikleri',
      'Aktif dinleme ve not alma stratejileri',
      'Sanal toplantı (Zoom/Teams) dil becerileri',
    ],
    ctaText: 'Toplantı İngilizcesi Programını Keşfet',
  },
  'sunum-teknikleri': {
    title: 'Sunum Teknikleri',
    category: 'Beceriye Göre',
    description:
      'İngilizce sunumlarınızı etkileyici ve akıcı hale getirin. Sphere English\'in Sunum Teknikleri programı; yapı kurma, veri aktarma, seyirciyle etkileşim ve güçlü kapanış teknikleri üzerine yoğunlaşır.',
    body: [
      'İş dünyasında ikna edici bir sunum, bir projenin ya da ürünün kaderini belirleyebilir. Sphere English\'in Sunum Teknikleri programı; salt bilgi aktarımının ötesinde, seyirciyle duygusal bağ kuran, veriyi hikâyeye dönüştüren ve sorulara güvenle yanıt veren sunumcular yetiştirmeyi hedefler. Yapı kurma, geçiş ifadeleri, grafik ve veri yorumlama dili ile Q&A yönetimi konularını kapsayan program; boardroom sunumlarından ürün lansmanı pitchlerine, yatırımcı brifinglerinden uluslararası konferans sunumlarına geniş bir pratik yelpazesi sunar.',
      'Türkiye\'deki çok uluslu şirketlerde görev yapan yöneticiler ve uzmanlar için özel olarak tasarlanan bu program, Oxford University Press müfredatıyla desteklenen içerikler aracılığıyla sunum İngilizcesinde en sık yapılan hatalardan kaçınmayı da öğretir. Katılımcılar; beden dili farkındalığı, ses tonu kontrolü ve seyirci analizi gibi yumuşak becerilerle birlikte güçlü bir sunum repertuvarı oluşturur.',
    ],
    highlights: [
      'Sunum yapısı ve akış tasarımı',
      'Grafik ve veri açıklama dili',
      'Seyirci sorularını yönetme',
      'Beden dili ve ses tonu farkındalığı',
    ],
    ctaText: 'Sunum Teknikleri Programını Keşfet',
  },
  'eposta-yazimi': {
    title: 'E-posta Yazımı',
    category: 'Beceriye Göre',
    description:
      'Profesyonel İngilizce e-postalar yazın; net, kibar ve etkili iletişim kurun. Sphere English\'in E-posta Yazımı programı; resmi yazışmalar, talep ve şikayet e-postaları ile iş dünyasının yazılı dil normlarını kapsar.',
    body: [
      'Günde yüzlerce iş e-postasının gönderildiği düşünüldüğünde, profesyonel yazışma becerisinin kariyer üzerindeki etkisi göz ardı edilemez. Sphere English\'in E-posta Yazımı programı; resmi talep ve teklif mektupları, müzakere sürecindeki yazışmalar, şikâyet ve özür e-postaları gibi gerçek iş hayatından alınmış şablonlar ve pratik senaryolar üzerine kurgulanmıştır. Program; konu satırı yazımından kapanış ifadelerine, tonlama seçiminden kültürel farkındalığa kadar iş İngilizcesi yazışmasının tüm boyutlarını kapsar.',
      'Özellikle Türk iş insanlarının sıkça yaptığı doğrudan çeviri hatalarına ve aşırı resmiyet tuzaklarına karşı güçlü bir dil bilinci geliştiren bu program; doğal, etkin ve güvenilir bir yazı dili oluşturmanızı sağlar. Yapay zeka destekli yazı analizi sistemi, her katılımcıya kişiselleştirilmiş geri bildirim sunarak gelişim sürecini hızlandırır.',
    ],
    highlights: [
      'Resmi ve yarı resmi e-posta formatları',
      'Talep, onay ve ret yazıları',
      'Şikayet ve özür e-postaları',
      'Konu satırı ve kapanış ifadeleri',
    ],
    ctaText: 'E-posta Yazımı Programını Keşfet',
  },
  'muzakere-ve-ikna': {
    title: 'Müzakere ve İkna',
    category: 'Beceriye Göre',
    description:
      'İngilizce müzakerelerde üstünlük sağlayın. Sphere English\'in Müzakere ve İkna programı; teklif sunma, karşı argüman geliştirme, uzlaşı bulma ve ikna edici dil kullanımı konularında derinlemesine pratik sunar.',
    body: [
      'Uluslararası müzakerelerde başarı; dil bilgisinin ötesinde, doğru anda doğru ifadeyi kullanabilme kapasitesiyle ölçülür. Sphere English\'in Müzakere ve İkna programı; teklif ve karşı teklif dili, uzlaşı ifadeleri, stratejik sessizlik ve kültürlerarası müzakere dinamikleri gibi ileri düzey becerileri kapsar. Gerçek vaka çalışmaları ve rol yapma (role-play) egzersizleriyle desteklenen bu program; satış müzakerelerinden tedarikçi görüşmelerine, iş ortaklığı anlaşmalarından ücret müzakerelerine kadar geniş bir uygulama alanına sahiptir.',
      'Türkiye\'de faaliyet gösteren uluslararası şirketlerin satış, hukuk ve üst yönetim ekipleri için özellikle kritik olan bu program, kursiyerlere müzakere masasında daha güçlü bir konum elde etme ve anlaşmaları kendi lehlerine sonuçlandırma konusunda somut araçlar sunar. İngilizce müzakerede kültürel zekâ ve bağlam okuma becerisini de edinen katılımcılar; küresel ortaklarıyla daha eşit ve etkili ilişkiler kurabilmektedir.',
    ],
    highlights: [
      'Teklif ve karşı teklif dili',
      'İkna edici argüman yapıları',
      'Uzlaşı ve taviz ifadeleri',
      'Kültürlerarası müzakere farkındalığı',
    ],
    ctaText: 'Müzakere ve İkna Programını Keşfet',
  },
  'telaffuz-ve-akicilik': {
    title: 'Telaffuz ve Akıcılık',
    category: 'Beceriye Göre',
    description:
      'Anlaşılır ve akıcı bir İngilizce telaffuz geliştirin. Sphere English\'in Telaffuz ve Akıcılık programı; ses bilgisi, vurgu, ritim ve doğal konuşma hızı üzerine kişiselleştirilmiş çalışmalar sunar.',
    body: [
      'Telaffuz, yalnızca sesleri doğru çıkarmak değil; akıcı, anlaşılır ve özgüvenli konuşmak anlamına gelir. Sphere English\'in Telaffuz ve Akıcılık programı; Türkçe konuşanların İngilizce\'de en çok zorlandığı sesler (ör. /v/-/w/, /æ/, /θ/), kelime vurgusu, cümle ritmi ve bağlantılı konuşma (connected speech) gibi fonetik beceriler üzerinde bireysel geri bildirimlerle çalışır. Yapay zeka destekli ses analizi teknolojisi sayesinde her katılımcının telaffuz profili çıkarılır ve kişiye özel pratik programı oluşturulur.',
      'Araştırmalar, anlaşılır bir telaffuzun iş toplantılarında mesaj iletim etkinliğini önemli ölçüde artırdığını göstermektedir. Sphere English\'in Telaffuz ve Akıcılık programı; kısa sürede somut ve ölçülebilir gelişme sağlamak isteyen iş profesyonelleri için tasarlanmıştır. Katılımcılar program sonunda; yabancı muhataplarla daha doğal, kendine güvenli ve keyifli bir konuşma deneyimi yaşadıklarını bildirmektedir.',
    ],
    highlights: [
      'Türkçe konuşanlar için kritik sesler',
      'Kelime ve cümle vurgusu',
      'Bağlantılı konuşma (connected speech)',
      'Özgüven artırıcı konuşma pratikleri',
    ],
    ctaText: 'Telaffuz ve Akıcılık Programını Keşfet',
  },
  'yoneticiler-icin': {
    title: 'Yöneticiler için',
    category: 'Rolüne Göre',
    description:
      'Liderlik iletişiminizi İngilizce\'de de güçlendirin. Sphere English\'in Yöneticiler programı; ekip yönetimi, performans görüşmeleri, stratejik sunum ve uluslararası paydaş iletişimi konularına odaklanır.',
    body: [
      'Liderlik iletişimi birden fazla dilde de aynı otorite ve netliği taşımalıdır. Sphere English\'in Yöneticiler için programı; C-suite iletişiminden ekip toplantısı yönetimine, performans görüşmelerinden kriz iletişimine kadar üst düzey yönetim senaryolarına odaklanır. Çok uluslu ekipleri yöneten, yabancı iş ortaklarıyla müzakere eden ya da uluslararası yatırımcılara rapor sunan yöneticiler için özel olarak tasarlanmış bu program; teknik dil bilgisinin ötesinde empati, ikna ve liderlik söylemini İngilizce\'de somutlaştırmayı hedefler.',
      'Türkiye\'nin önde gelen şirketlerinde görev yapan üst düzey yöneticiler Sphere English\'i tercih etmektedir. Program kapsamında; uluslararası yönetim kurulu sunumları, çok kültürlü ekiplerle iletişim, değişim yönetimi konuşmaları ve medya ile analist görüşmeleri gibi gerçek liderlik senaryoları üzerinden yoğun pratik yapılmaktadır. Programa katılan yöneticiler, uluslararası toplantılardaki katılım kalitesini ve özgüvenlerini belirgin biçimde artırmaktadır.',
    ],
    highlights: [
      'Ekip toplantılarını yönetme',
      'Performans ve geri bildirim görüşmeleri',
      'C-level iletişim dili',
      'Kriz ve değişim yönetimi iletişimi',
    ],
    ctaText: 'Yöneticiler Programını Keşfet',
  },
  'ik-profesyonelleri': {
    title: 'İK Profesyonelleri',
    category: 'Rolüne Göre',
    description:
      'İnsan kaynakları süreçlerinizi İngilizce\'de etkin yönetin. Sphere English\'in İK Profesyonelleri programı; mülakat yönetimi, iş ilanı yazımı, onboarding ve çalışan iletişimi konularını kapsar.',
    body: [
      'İnsan kaynakları departmanları; uluslararası iş gücü piyasasında aday bulma, global şirket politikalarını uygulama ve yabancı uyruklu çalışanları şirkete entegre etme sorumluluğunu taşımaktadır. Sphere English\'in İK Profesyonelleri programı; İngilizce mülakat yönetimi, yetkinlik bazlı soru teknikleri, iş ilanı yazımı ve çalışan onboardingine özel dil becerilerini geliştirir. Program aynı zamanda; yıllık değerlendirme görüşmeleri, disiplin süreçleri ve hassas İK senaryolarında doğru tonlama ve yasal dil bilincini kazandırır.',
      'Türkiye\'deki çok uluslu şirketlerin İK ekipleri ve uluslararası işe alım süreçleri yürüten İK uzmanları bu programı tercih etmektedir. İş ilanı yazımından çıkış görüşmesi yönetimine, çalışan bağlılığı iletişiminden global İK politikası uygulamalarına kadar kapsamlı bir içerik sunan program; İK profesyonellerinin küresel standartlarda hizmet verebilmesini destekler.',
    ],
    highlights: [
      'İngilizce mülakat teknikleri',
      'İş ilanı ve yetkinlik tanımları',
      'Onboarding ve oryantasyon dili',
      'Çalışan bağlılığı iletişimi',
    ],
    ctaText: 'İK Profesyonelleri Programını Keşfet',
  },
  'satis-ekipleri': {
    title: 'Satış Ekipleri',
    category: 'Rolüne Göre',
    description:
      'Uluslararası müşterilerle güçlü satış ilişkileri kurun. Sphere English\'in Satış Ekipleri programı; müşteri görüşmeleri, teklif sunma, itiraz yönetimi ve kapanış teknikleri üzerine yoğunlaşır.',
    body: [
      'Uluslararası satışta dil; yalnızca bir araç değil, güven inşa eden ve kapanışı kolaylaştıran en kritik rekabet avantajıdır. Sphere English\'in Satış Ekipleri programı; müşteri ihtiyaç analizi, ürün ve hizmet tanıtımı, itiraz yönetimi ve satış kapanış teknikleri konularında yoğun pratik sunar. Program; B2B ve B2C satış senaryoları, uluslararası fuar ve networking ortamları ile dijital satış iletişimi (e-posta, video görüşmesi, LinkedIn) boyutlarını kapsamaktadır.',
      'Türkiye merkezli ihracatçı firmalar, global SaaS şirketleri ve çok uluslu satış ekipleri bu programı tercih etmektedir. Sphere English kursiyerleri, program sonunda uluslararası müşterilerle daha hızlı güven ilişkisi kurduklarını, itirazları daha etkili karşıladıklarını ve satış süreçlerini kısalttıklarını bildirmektedir. CRM araçları, e-posta kampanyaları ve sosyal satış pratiklerine özel dil modülleri programa dahildir.',
    ],
    highlights: [
      'Müşteri ihtiyaç analizi dili',
      'Ürün ve hizmet sunumu',
      'İtiraz karşılama teknikleri',
      'Satış kapanış ifadeleri',
    ],
    ctaText: 'Satış Ekipleri Programını Keşfet',
  },
  'teknik-ekipler': {
    title: 'Teknik Ekipler',
    category: 'Rolüne Göre',
    description:
      'Teknik bilginizi İngilizce\'de net ve etkili aktarın. Sphere English\'in Teknik Ekipler programı; teknik dokümantasyon, proje toplantıları, kod review ve uluslararası ekip iletişimi konularını kapsar.',
    body: [
      'Yazılım geliştirme, veri analizi ya da mühendislik alanında çalışan profesyoneller için İngilizce; kod kadar kritik bir iletişim aracıdır. Sphere English\'in Teknik Ekipler programı; sprint planlaması, kod review, teknik dokümantasyon ve uluslararası takım toplantıları gibi gerçek yazılım geliştirme senaryolarına dayalı dil becerileri kazandırır. GitHub, Confluence ve Jira gibi araçlarda profesyonel İngilizce yazışma pratikleri de programa dahildir.',
      'Global teknoloji şirketlerinde remote çalışan Türk mühendisler ve Türkiye\'deki çok uluslu teknoloji şirketlerinin teknik kadroları bu programı tercih etmektedir. Teknik bilgiyi İngilizce\'de sade ve anlaşılır biçimde aktarma, teknik olmayan paydaşlara iletebilme ve global takımlarda görünür olma konularında somut gelişme sağlayan program; kariyer gelişimini uluslararası ölçeğe taşımak isteyen mühendisler ve teknik liderler için stratejik bir yatırımdır.',
    ],
    highlights: [
      'Teknik kavramları sade dille açıklama',
      'Sprint ve proje toplantı dili',
      'Teknik yazışma ve dokümantasyon',
      'Uluslararası ekiplerle iş birliği',
    ],
    ctaText: 'Teknik Ekipler Programını Keşfet',
  },
  'finans-ingilizcesi': {
    title: 'Finans İngilizcesi',
    category: 'Sektöre Göre',
    description:
      'Finans dünyasının diline hakim olun. Sphere English\'in Finans İngilizcesi programı; finansal raporlama, yatırımcı sunumları, bütçe görüşmeleri ve bankacılık terminolojisi konularında uzmanlaşmanızı sağlar.',
    body: [
      'Finans sektöründe her kelimenin hukuki, ticari ve mali sonuçları olabilir. Sphere English\'in Finans İngilizcesi programı; finansal tablolar, yatırımcı ilişkileri raporları, bütçe görüşmeleri ve risk değerlendirme toplantıları gibi finans profesyonellerinin günlük olarak karşılaştığı senaryolara özel dil becerileri kazandırır. IFRS, Basel III ve CFA gibi uluslararası standartların terminolojisi programa entegre edilmiş olup bankacılık, sermaye piyasaları, kurumsal finans ve fintech alanları için ayrı modüller bulunmaktadır.',
      'İstanbul Finans Merkezi (İFM) ekosisteminde yetkinliklerini geliştirmek isteyen finans uzmanları için stratejik bir yatırım olan bu program; yatırımcı sunumları, analist raporlaması ve uluslararası banka ile fon toplantılarına özel içerikleriyle benzerlerinden ayrışmaktadır. Katılımcılar, program sonunda küresel finans çevrelerinde güvenle iletişim kurabilmekte ve uluslararası iş fırsatlarına daha etkin biçimde erişebilmektedir.',
    ],
    highlights: [
      'Finansal rapor okuma ve yorumlama',
      'Yatırımcı ve paydaş sunumları',
      'Bütçe ve tahmin görüşmeleri',
      'Bankacılık ve fintech terminolojisi',
    ],
    ctaText: 'Finans İngilizcesi Programını Keşfet',
  },
  'teknoloji-ingilizcesi': {
    title: 'Teknoloji İngilizcesi',
    category: 'Sektöre Göre',
    description:
      'Teknoloji sektörünün hızlı tempolu iletişim ortamında öne çıkın. Sphere English\'in Teknoloji İngilizcesi programı; ürün geliştirme, startup ekosistemi, yatırımcı pitch\'leri ve global teknoloji konferansları için dil becerileri sunar.',
    body: [
      'Küresel teknoloji ekosistemi İngilizce üzerine kurulmuştur; startup\'lar, yatırımcı pitch\'leri, ürün dokümantasyonu ve teknoloji konferansları bu dilin keskin kullanımını gerektirir. Sphere English\'in Teknoloji İngilizcesi programı; Türkiye\'den dünyaya açılan teknoloji şirketlerinin kurucuları, ürün yöneticileri ve mühendisleri için tasarlanmış olup ürün tanımlama ve roadmap sunumu, yatırımcı Q&A yönetimi, teknik blog yazarlığı ve uluslararası developer topluluklarıyla iletişim konularını kapsar.',
      'Türkiye\'nin teknoloji ihracatını artırma hedefleri doğrultusunda özellikle B2B SaaS, yapay zeka, fintech ve e-ticaret alanlarındaki girişimciler ve yöneticiler için kritik bir yetkinlik programı olan Sphere English Teknoloji İngilizcesi; Y Combinator Demo Day\'den TechCrunch Disrupt\'a, Google for Startups programlarından uluslararası VC görüşmelerine kadar global teknoloji arenasının dilini öğretir.',
    ],
    highlights: [
      'Ürün ve özellik tanımlama dili',
      'Startup ve yatırımcı iletişimi',
      'Agile ve Scrum toplantı dili',
      'Teknoloji konferansı ve networking',
    ],
    ctaText: 'Teknoloji İngilizcesi Programını Keşfet',
  },
  'saglik-ingilizcesi': {
    title: 'Sağlık İngilizcesi',
    category: 'Sektöre Göre',
    description:
      'Sağlık sektöründe uluslararası standartlarda iletişim kurun. Sphere English\'in Sağlık İngilizcesi programı; hasta iletişimi, tıbbi terminoloji, uluslararası konferanslar ve akademik yazım konularını kapsar.',
    body: [
      'Sağlık profesyonelleri için İngilizce; uluslararası araştırmalara erişim, kongre sunumları, akademik yayın ve yabancı hastalara ya da meslektaşlara profesyonel hizmet sunumu anlamına gelir. Sphere English\'in Sağlık İngilizcesi programı; tıbbi terminoloji, klinik vaka sunumları, hasta-hekim iletişimi ve akademik makale yazımı gibi sağlık sektörüne özel dil becerilerini kapsayan, sahaya yönelik bir içerik mimarisi üzerine inşa edilmiştir.',
      'Türkiye\'nin sağlık turizmi sektörünün hızlı büyümesi, doktor, hemşire ve sağlık yöneticilerinin yabancı hastalarla etkili iletişim kurmasını zorunlu kılmaktadır. Özellikle JCI akreditasyonu hedefleyen hastanelerin uluslararası hasta hizmetleri ekipleri, tıp akademisyenleri ve uluslararası kongrelere katılım hedefleyen klinisyenler için tasarlanan bu program; hem klinik iletişim kalitesini hem de akademik görünürlüğü artırmayı destekler.',
    ],
    highlights: [
      'Tıbbi terminoloji ve klinik dil',
      'Hasta ve aile iletişimi',
      'Uluslararası sağlık konferansları',
      'Akademik makale ve sunum dili',
    ],
    ctaText: 'Sağlık İngilizcesi Programını Keşfet',
  },
  'hukuk-ingilizcesi': {
    title: 'Hukuk İngilizcesi',
    category: 'Sektöre Göre',
    description:
      'Hukuki süreçlerde İngilizce\'yi güvenle kullanın. Sphere English\'in Hukuk İngilizcesi programı; sözleşme dili, mahkeme iletişimi, hukuki yazışmalar ve uluslararası tahkim süreçleri için kapsamlı dil eğitimi sunar.',
    body: [
      'Uluslararası ticaret hukuku, tahkim süreçleri ve çok taraflı sözleşmeler; hassas ve doğru bir hukuki İngilizce bilgisi gerektirir. Sphere English\'in Hukuk İngilizcesi programı; sözleşme inceleme ve yorumlama, hukuki yazışmalar, uluslararası tahkim prosedürleri ve müvekkil danışmanlık görüşmeleri konularında kapsamlı dil eğitimi sunar. Common law sisteminin temel kavramları ve uluslararası ticaret hukukunun terminolojisi programa dahil olup ICC, ICSID ve LCIA kuralları çerçevesinde tahkim pratiği de içeriğin önemli bir parçasını oluşturmaktadır.',
      'Türkiye\'de uluslararası hukuk bürolarında çalışan avukatlar, hukuk danışmanları ve şirket hukuk departmanlarının üyeleri bu programı tercih etmektedir. Sözleşme müzakeresi, due diligence raporu hazırlama ve uluslararası arabuluculuk gibi kritik hukuki senaryolara özel içerikleriyle program; hukuk profesyonellerinin küresel standartlarda hizmet verebilmesine ve uluslararası iş fırsatlarını değerlendirebilmesine somut katkı sağlar.',
    ],
    highlights: [
      'Sözleşme ve anlaşma terminolojisi',
      'Hukuki yazışma ve dilekçe dili',
      'Uluslararası tahkim ve arabuluculuk',
      'Müvekkil görüşmeleri ve danışmanlık',
    ],
    ctaText: 'Hukuk İngilizcesi Programını Keşfet',
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const solution = solutions[slug];
  if (!solution) return { title: 'Sayfa Bulunamadı | Sphere English' };
  return {
    title: `${solution.title} | Sphere English`,
    description: solution.description,
    alternates: { canonical: `https://www.sphereenglish.com/cozumler/${slug}` },
    openGraph: {
      title: `${solution.title} | Sphere English`,
      description: solution.description,
      url: `https://www.sphereenglish.com/cozumler/${slug}`,
    },
  };
}

export async function generateStaticParams() {
  return Object.keys(solutions).map((slug) => ({ slug }));
}

export default async function CozumlerPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = solutions[slug];

  if (!solution) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <Header forceWhite />
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 bg-gradient-to-br from-[#082567] to-[#1a3a8f] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[11px] font-bold tracking-[0.22em] text-blue-200 uppercase mb-4">
            {solution.category}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
            {solution.title}
          </h1>
          <p className="text-lg md:text-xl text-blue-100 leading-relaxed max-w-2xl mx-auto">
            {solution.description}
          </p>
        </div>
      </section>

      {/* Body — SEO & GEO optimised paragraphs */}
      <section className="py-16 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {solution.body.map((paragraph, i) => (
            <p key={i} className="text-[16px] text-gray-700 leading-[1.8]">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* Highlights */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-[#082567] mb-10 text-center tracking-tight">
            Program İçeriği
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {solution.highlights.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 rounded-2xl border border-gray-100 bg-gray-50 hover:border-[#082567]/20 hover:bg-blue-50/30 transition-all duration-200"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-[#082567] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[15px] text-anthracite font-medium leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-2xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-[#082567] mb-4">
            Hemen Başlayın
          </h3>
          <p className="text-gray-600 mb-8 text-[15px]">
            Ekibiniz veya kendiniz için özel bir program oluşturmak ister misiniz? Uzmanlarımızla ücretsiz görüşün.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/#iletisim"
              className="px-8 py-3.5 rounded-full text-white font-bold text-[13px] tracking-[0.14em] transition-all duration-200 hover:opacity-90 hover:shadow-lg"
              style={{ background: '#082567' }}
            >
              {solution.ctaText}
            </Link>
            <Link
              href="/cozumler"
              className="px-8 py-3.5 rounded-full text-[#082567] font-bold text-[13px] tracking-[0.14em] border-2 border-[#082567] hover:bg-[#082567] hover:text-white transition-all duration-200"
            >
              Tüm Çözümleri Gör
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
