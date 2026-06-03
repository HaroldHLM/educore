import { PrismaClient, Role, Plan, AttendanceStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // ─────────────────────────────────────────
  // INSTITUCIÓN
  // ─────────────────────────────────────────
  const institution = await prisma.institution.upsert({
    where: { slug: 'colegio-demo' },
    update: {},
    create: {
      name: 'Colegio San Marcos',
      slug: 'colegio-demo',
      plan: Plan.PRO,
      primaryColor: '#2563EB',
    },
  });
  console.log(`✅ Institución: ${institution.name}`);

  // ─────────────────────────────────────────
  // USUARIOS + MEMBRESÍAS
  // ─────────────────────────────────────────
  const password = await bcrypt.hash('Password123!', 10);

  // Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@educore.com' },
    update: {},
    create: {
      email: 'admin@educore.com',
      password,
      firstName: 'Carlos',
      lastName: 'Mendoza',
    },
  });
  await prisma.membership.upsert({
    where: { userId_institutionId: { userId: adminUser.id, institutionId: institution.id } },
    update: {},
    create: {
      userId: adminUser.id,
      institutionId: institution.id,
      role: Role.INSTITUTION_ADMIN,
    },
  });
  console.log(`✅ Admin: ${adminUser.email}`);

  // Docente 1
  const teacherUser1 = await prisma.user.upsert({
    where: { email: 'maria.garcia@educore.com' },
    update: {},
    create: {
      email: 'maria.garcia@educore.com',
      password,
      firstName: 'María',
      lastName: 'García',
    },
  });
  await prisma.membership.upsert({
    where: { userId_institutionId: { userId: teacherUser1.id, institutionId: institution.id } },
    update: {},
    create: {
      userId: teacherUser1.id,
      institutionId: institution.id,
      role: Role.TEACHER,
    },
  });

  // Teacher usa createOrUpdate por userId + institutionId (no tiene @@unique propio)
  let teacher1 = await prisma.teacher.findFirst({
    where: { userId: teacherUser1.id, institutionId: institution.id },
  });
  if (!teacher1) {
    teacher1 = await prisma.teacher.create({
      data: {
        institutionId: institution.id,
        userId: teacherUser1.id,
        specialty: 'Matemáticas',
      },
    });
  }
  console.log(`✅ Docente 1: ${teacherUser1.email}`);

  // Docente 2
  const teacherUser2 = await prisma.user.upsert({
    where: { email: 'juan.perez@educore.com' },
    update: {},
    create: {
      email: 'juan.perez@educore.com',
      password,
      firstName: 'Juan',
      lastName: 'Pérez',
    },
  });
  await prisma.membership.upsert({
    where: { userId_institutionId: { userId: teacherUser2.id, institutionId: institution.id } },
    update: {},
    create: {
      userId: teacherUser2.id,
      institutionId: institution.id,
      role: Role.TEACHER,
    },
  });

  let teacher2 = await prisma.teacher.findFirst({
    where: { userId: teacherUser2.id, institutionId: institution.id },
  });
  if (!teacher2) {
    teacher2 = await prisma.teacher.create({
      data: {
        institutionId: institution.id,
        userId: teacherUser2.id,
        specialty: 'Lenguaje',
      },
    });
  }
  console.log(`✅ Docente 2: ${teacherUser2.email}`);

  // ─────────────────────────────────────────
  // PERIODO ACADÉMICO
  // ─────────────────────────────────────────
  // Period no tiene @@unique en name, usamos findFirst + create
  let period = await prisma.period.findFirst({
    where: { institutionId: institution.id, name: '2026 — I Trimestre' },
  });
  if (!period) {
    period = await prisma.period.create({
      data: {
        institutionId: institution.id,
        name: '2026 — I Trimestre',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-06-30'),
        isActive: true,
      },
    });
  }
  console.log(`✅ Periodo: ${period.name}`);

  // ─────────────────────────────────────────
  // CURSO
  // ─────────────────────────────────────────
  // Course representa aula/grado/sección/año. Las materias viven en Subject.
  let course = await prisma.course.findFirst({
    where: { institutionId: institution.id, grade: '5to', section: 'A', year: 2026 },
  });
  if (!course) {
    course = await prisma.course.create({
      data: {
        institutionId: institution.id,
        grade: '5to',
        section: 'A',
        year: 2026,
      },
    });
  }
  console.log(`✅ Curso: ${course.grade} ${course.section} - ${course.year}`);

  // Asignar docentes al curso (CourseTeacher tiene @@id compuesto)
  await prisma.courseTeacher.upsert({
    where: { courseId_teacherId: { courseId: course.id, teacherId: teacher1.id } },
    update: {},
    create: { courseId: course.id, teacherId: teacher1.id },
  });
  await prisma.courseTeacher.upsert({
    where: { courseId_teacherId: { courseId: course.id, teacherId: teacher2.id } },
    update: {},
    create: { courseId: course.id, teacherId: teacher2.id },
  });

  // ─────────────────────────────────────────
  // MATERIAS
  // ─────────────────────────────────────────
  // Subject no tiene @@unique, buscamos por name + courseId
  const subjectsData = [
    { name: 'Matemática',  credits: 4, weight: 1.5 },
    { name: 'Lenguaje',    credits: 4, weight: 1.5 },
    { name: 'Ciencias',    credits: 3, weight: 1.0 },
    { name: 'Historia',    credits: 3, weight: 1.0 },
    { name: 'Inglés',      credits: 2, weight: 1.0 },
  ];

  const subjects = await Promise.all(
    subjectsData.map(async (s) => {
      const existing = await prisma.subject.findFirst({
        where: { courseId: course!.id, name: s.name },
      });
      if (existing) return existing;
      return prisma.subject.create({
        data: { courseId: course!.id, ...s },
      });
    })
  );
  console.log(`✅ Materias: ${subjects.map(s => s.name).join(', ')}`);

  // ─────────────────────────────────────────
  // ESTUDIANTES
  // ─────────────────────────────────────────
  const studentsData = [
    { code: '2026001', firstName: 'Lucía',     lastName: 'Torres',   email: 'lucia.torres@demo.com',   parentName: 'Ana Torres',     parentPhone: '999111001' },
    { code: '2026002', firstName: 'Diego',     lastName: 'Ramírez',  email: 'diego.ramirez@demo.com',  parentName: 'Luis Ramírez',   parentPhone: '999111002' },
    { code: '2026003', firstName: 'Sofía',     lastName: 'Castro',   email: 'sofia.castro@demo.com',   parentName: 'Rosa Castro',    parentPhone: '999111003' },
    { code: '2026004', firstName: 'Mateo',     lastName: 'Vega',     email: 'mateo.vega@demo.com',     parentName: 'Jorge Vega',     parentPhone: '999111004' },
    { code: '2026005', firstName: 'Valentina', lastName: 'Flores',   email: 'vale.flores@demo.com',    parentName: 'Carmen Flores',  parentPhone: '999111005' },
    { code: '2026006', firstName: 'Sebastián', lastName: 'Morales',  email: 'seba.morales@demo.com',   parentName: 'Pedro Morales',  parentPhone: '999111006' },
    { code: '2026007', firstName: 'Isabella',  lastName: 'Herrera',  email: 'isa.herrera@demo.com',    parentName: 'Gloria Herrera', parentPhone: '999111007' },
    { code: '2026008', firstName: 'Nicolás',   lastName: 'Jiménez',  email: 'nico.jimenez@demo.com',   parentName: 'Marta Jiménez',  parentPhone: '999111008' },
  ];

  // Student tiene @@unique([institutionId, code]) — podemos usar upsert
  const students = await Promise.all(
    studentsData.map(s =>
      prisma.student.upsert({
        where: { institutionId_code: { institutionId: institution.id, code: s.code } },
        update: {},
        create: { institutionId: institution.id, ...s },
      })
    )
  );
  console.log(`✅ Estudiantes: ${students.length} creados`);

  // Matrículas — Enrollment tiene @@unique([studentId, courseId])
  await Promise.all(
    students.map(s =>
      prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId: s.id, courseId: course!.id } },
        update: {},
        create: {
          institutionId: institution.id,
          studentId: s.id,
          courseId: course!.id,
        },
      })
    )
  );
  console.log(`✅ Matrículas: ${students.length} registradas`);

  // ─────────────────────────────────────────
  // NOTAS (sobre 20 — sistema peruano)
  // ─────────────────────────────────────────
  // Grade tiene @@unique([studentId, subjectId, periodId])
  const scoresTable: number[][] = [
    [18, 17, 16, 15, 19], // Lucía
    [12, 11, 13, 10, 14], // Diego
    [20, 19, 18, 20, 17], // Sofía
    [15, 14, 16, 13, 15], // Mateo
    [17, 16, 15, 18, 16], // Valentina
    [10,  9, 11, 12, 10], // Sebastián
    [14, 15, 13, 16, 14], // Isabella
    [16, 17, 15, 14, 18], // Nicolás
  ];

  for (let si = 0; si < students.length; si++) {
    await Promise.all(
      subjects.map((subject, ji) =>
        prisma.grade.upsert({
          where: {
            studentId_subjectId_periodId: {
              studentId: students[si].id,
              subjectId: subject.id,
              periodId:  period!.id,
            },
          },
          update: {},
          create: {
            institutionId: institution.id,
            studentId:     students[si].id,
            subjectId:     subject.id,
            periodId:      period!.id,
            score:         scoresTable[si][ji],
            gradedBy:      teacherUser1.id,
          },
        })
      )
    );
  }
  console.log(`✅ Notas: registradas para ${students.length} estudiantes`);

  // ─────────────────────────────────────────
  // ASISTENCIA
  // ─────────────────────────────────────────
  // Attendance tiene @@unique([studentId, date])
  const attendanceDates = [
    new Date('2026-06-03'),
    new Date('2026-06-04'),
    new Date('2026-06-05'),
    new Date('2026-06-06'),
    new Date('2026-06-07'),
  ];

  const statusTable: AttendanceStatus[][] = [
    [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT],
    [AttendanceStatus.PRESENT, AttendanceStatus.ABSENT,  AttendanceStatus.PRESENT, AttendanceStatus.LATE,    AttendanceStatus.PRESENT],
    [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT],
    [AttendanceStatus.LATE,    AttendanceStatus.PRESENT, AttendanceStatus.ABSENT,  AttendanceStatus.PRESENT, AttendanceStatus.PRESENT],
    [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE],
    [AttendanceStatus.ABSENT,  AttendanceStatus.ABSENT,  AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.ABSENT],
    [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.LATE,    AttendanceStatus.PRESENT, AttendanceStatus.PRESENT],
    [AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.PRESENT, AttendanceStatus.ABSENT,  AttendanceStatus.PRESENT],
  ];

  for (let si = 0; si < students.length; si++) {
    await Promise.all(
      attendanceDates.map((date, di) =>
        prisma.attendance.upsert({
          where: { studentId_date: { studentId: students[si].id, date } },
          update: {},
          create: {
            institutionId: institution.id,
            studentId: students[si].id,
            periodId:  period!.id,
            date,
            status:    statusTable[si][di],
          },
        })
      )
    );
  }
  console.log(`✅ Asistencia: registrada para ${students.length} estudiantes`);

  // ─────────────────────────────────────────
  // RESUMEN FINAL
  // ─────────────────────────────────────────
  console.log('\n──────────────────────────────────────────');
  console.log('🎉 Seed completado\n');
  console.log('📋 Credenciales (password: Password123!):\n');
  console.log('  ROL               EMAIL');
  console.log('  ────────────────  ────────────────────────────');
  console.log('  INSTITUTION_ADMIN admin@educore.com');
  console.log('  TEACHER           maria.garcia@educore.com');
  console.log('  TEACHER           juan.perez@educore.com');
  console.log('\n🏫 Slug:      colegio-demo');
  console.log('📅 Periodo:   2026 — I Trimestre');
  console.log('📚 Curso:     5to A - 2026');
  console.log(`👥 Alumnos:   ${students.length}`);
  console.log('──────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
