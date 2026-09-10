const mongoose = require("mongoose");

const Student = require("../models/Student");
const Plan = require("../models/Plan");
const Attendance = require("../models/Attendance");
const Performance = require("../models/Performance");


// ==============================
// GET STUDENT PROGRESS
// ==============================
const getStudentProgress = async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(studentId)
      .populate("branch", "name address")
      .populate("plan");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Branch-level access
    if (
      ["BRANCH_ADMIN", "COACH"].includes(req.user.role) &&
      student.branch._id.toString() !== req.user.branch.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this student",
      });
    }

    const attendance = await Attendance.find({
      student: studentId,
    }).sort({ date: 1 });

    const performance = await Performance.find({
      student: studentId,
    }).sort({ evaluationDate: -1 });

    const presentClasses = attendance.filter(
      (record) => record.status === "PRESENT"
    );

    const absentClasses = attendance.filter(
      (record) => record.status === "ABSENT"
    );

    const pendingMakeups = attendance.filter(
      (record) =>
        record.makeupRequired === true &&
        record.makeupCompleted === false
    );

    const completedMakeups = attendance.filter(
      (record) =>
        record.makeupRequired === true &&
        record.makeupCompleted === true
    );

    /*
      A training day is considered completed when:
      - Attendance is PRESENT
      - OR an ABSENT class has its makeup completed
    */
    const completedTrainingDays = attendance
      .filter(
        (record) =>
          record.status === "PRESENT" ||
          (record.makeupRequired === true &&
            record.makeupCompleted === true)
      )
      .map((record) => record.planDay);

    const uniqueCompletedDays = [...new Set(completedTrainingDays)];

    const currentTrainingDay =
      uniqueCompletedDays.length > 0
        ? Math.max(...uniqueCompletedDays)
        : 0;

    // Find the next milestone
    const nextMilestone = student.plan.milestones
      .filter((milestone) => milestone.day > currentTrainingDay)
      .sort((a, b) => a.day - b.day)[0] || null;

    // Find the last achieved milestone
    const achievedMilestone = student.plan.milestones
      .filter((milestone) => milestone.day <= currentTrainingDay)
      .sort((a, b) => b.day - a.day)[0] || null;

    const averageRating =
      performance.length > 0
        ? Number(
            (
              performance.reduce(
                (sum, record) => sum + record.rating,
                0
              ) / performance.length
            ).toFixed(2)
          )
        : null;

    const currentCurriculum = student.plan.curriculum.find(
      (lesson) => lesson.day === currentTrainingDay + 1
    ) || null;

    res.status(200).json({
      success: true,

      progress: {
        student: {
          id: student._id,
          name: student.name,
          currentBelt: student.currentBelt,
          status: student.status,
        },

        plan: {
          id: student.plan._id,
          name: student.plan.name,
          duration: student.plan.duration,
          durationUnit: student.plan.durationUnit,
        },

        training: {
          currentTrainingDay,
          completedDays: uniqueCompletedDays.length,
          totalCurriculumDays: student.plan.curriculum.length,
          presentClasses: presentClasses.length,
          absentClasses: absentClasses.length,
          pendingMakeups: pendingMakeups.length,
          completedMakeups: completedMakeups.length,
        },

        currentCurriculum,

        milestone: {
          achieved: achievedMilestone,
          next: nextMilestone,
        },

        performance: {
          totalEvaluations: performance.length,
          averageRating,
          latest: performance[0] || null,
        },
      },
    });
  } catch (error) {
    console.error("Get student progress error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch student progress",
    });
  }
};


module.exports = {
  getStudentProgress,
};