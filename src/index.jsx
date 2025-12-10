import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Plus, RefreshCw, Check } from "lucide-react-native";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SyncOptionsModal, LoadingModal } from "./components/SyncModals";
import { AddWorkoutModal } from "./components/AddWorkoutModal";
import {
  getWorkouts,
  initInstallDate,
  getStats,
  updateWorkoutProgress,
  markTodayComplete,
  getCurrentRotationWorkout,
  advanceToNextDay,
  restoreImages,
} from "./services/storage";
import {
  uploadDataToCloud,
  downloadDataFromCloud,
  getLocalSyncId,
} from "./services/cloud";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const ExerciseItem = ({ item, onToggle }) => {
  const swipeableRef = useRef(null);

  const ExerciseContent = () => (
    <View
      className={cn(
        "bg-[#2a0e0e] flex-row items-center justify-between p-4 h-28 w-full rounded-[36px]",
        item.completed && "opacity-50"
      )}
    >
      {/* Left Square Placeholder */}
      <View className="w-16 h-16 bg-[#d9d9d9] overflow-hidden rounded-lg">
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : null}
      </View>

      {/* Exercise Name */}
      <Text className="text-white text-xl font-normal tracking-wide">
        {item.name}
      </Text>

      {/* Right Circle Button */}
      <TouchableOpacity
        onPress={() => onToggle(item.id)}
        disabled={item.completed}
        activeOpacity={0.7}
        className={cn(
          "w-12 h-12 rounded-full items-center justify-center",
          item.completed ? "bg-green-500" : "bg-[#d9d9d9]"
        )}
      >
        {item.completed && <Check size={24} color="#fff" />}
      </TouchableOpacity>
    </View>
  );

  if (item.completed) {
    return <ExerciseContent />;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      overshootLeft={false}
      overshootRight={true}
      onSwipeableOpen={(direction) => {
        if (direction === "left") {
          onToggle(item.id);
          swipeableRef.current?.close();
        }
      }}
    >
      <ExerciseContent />
    </Swipeable>
  );
};

export default function WorkoutScreen() {
  const [exercises, setExercises] = useState([]);
  const [workoutTitle, setWorkoutTitle] = useState("Workout");
  const [currentDay, setCurrentDay] = useState("1");
  const [stats, setStats] = useState({ totalDays: 1, completedDays: 0 });
  const [currentSyncId, setCurrentSyncId] = useState(null);

  const loadData = useCallback(async () => {
    await initInstallDate();
    const s = await getStats();
    setStats(s);

    const id = await getLocalSyncId();
    setCurrentSyncId(id);

    const activeWorkout = await getCurrentRotationWorkout();
    if (activeWorkout) {
      setWorkoutTitle(activeWorkout.title || `Day ${activeWorkout.day}`);
      setExercises(activeWorkout.exercises || []);
      setCurrentDay(activeWorkout.day);
    } else {
      setExercises([]);
      setWorkoutTitle("No Workouts");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleComplete = async (id) => {
    const updatedExercises = exercises.map((ex) =>
      ex.id === id && !ex.completed ? { ...ex, completed: true } : ex
    );
    setExercises(updatedExercises);
    // Update the pending state in storage (so if they close app, it's saved)
    await updateWorkoutProgress(currentDay, updatedExercises);

    // Check if ALL exercises are now completed
    if (
      updatedExercises.every((e) => e.completed) &&
      updatedExercises.length > 0
    ) {
      // 1. Mark the day as consistent (stat++)
      const marked = await markTodayComplete();

      // 2. Just refresh logic (don't advance day yet)
      const s = await getStats();
      setStats(s);
    }
  };

  const [isSyncModalVisible, setSyncModalVisible] = useState(false);
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isLoadingVisible, setLoadingVisible] = useState(false);
  const [loadingText, setLoadingText] = useState("");

  const handleSyncPress = () => setSyncModalVisible(true);

  const handleOptionSelect = async (type, manualId = null) => {
    setLoadingText(
      type === "upload" ? "Uploading Data..." : "Downloading Data..."
    );
    setLoadingVisible(true);

    try {
      if (type === "upload") {
        // Mark sync timestamp as requested
        await AsyncStorage.setItem(
          "gym_tracker_last_sync",
          new Date().toISOString()
        );

        // Gather all data
        const allKeys = await AsyncStorage.getAllKeys();
        const allData = await AsyncStorage.multiGet(allKeys);
        const dataObj = Object.fromEntries(allData);

        const result = await uploadDataToCloud(dataObj);

        if (result.success) {
          setCurrentSyncId(result.syncId);
          Alert.alert("Success", "Data synced to cloud!");
        } else {
          Alert.alert("Error", "Upload failed.");
        }
      } else {
        // Download
        const result = await downloadDataFromCloud(manualId);

        if (result.success && result.data) {
          // Wipe current and restore
          const keys = Object.keys(result.data);
          const pairs = keys.map((k) => [k, result.data[k]]);

          await AsyncStorage.clear();
          await AsyncStorage.multiSet(pairs);

          await loadData(); // Reload app state

          // Trigger background image restoration
          setLoadingText("Restoring images...");
          await restoreImages();
          await loadData(); // Reload again to show images

          setSyncModalVisible(false);
          Alert.alert("Success", "Data restored from cloud!");
        } else {
          Alert.alert("Error", result.error || "Download failed.");
        }
      }
    } catch (e) {
      Alert.alert("Error", "An unexpected error occurred.");
      console.error(e);
    } finally {
      setLoadingVisible(false);
    }
  };

  return (
    <>
      <GestureHandlerRootView className="flex-1 bg-white relative">
        <View className="bg-gray-100 flex-row justify-between items-center px-6 pt-12 py-4 border-b border-gray-200">
          <TouchableOpacity
            className="p-2 bg-white rounded-full shadow-sm"
            onPress={handleSyncPress}
          >
            <RefreshCw size={20} color="#000" />
          </TouchableOpacity>
          <View className="bg-white px-4 py-2 rounded-lg shadow-sm w-24 items-center">
            <Text className="text-xl font-bold">
              {stats.totalDays}/{stats.completedDays}
            </Text>
          </View>
        </View>

        {/* Title Section */}
        <View className="pt-8 pb-8 items-center justify-center">
          <Text className="text-4xl font-bold text-black tracking-widest">
            {workoutTitle}
          </Text>
        </View>

        {/* Exercises List */}
        <ScrollView className="flex-1 px-5 mx-2 mb-6 rounded-[40px] overflow-hidden">
          <View className="gap-6 pb-32">
            {exercises.length === 0 ? (
              <View className="items-center justify-center pt-10">
                <Text className="text-gray-400 text-lg">
                  No exercises found. Add one!
                </Text>
              </View>
            ) : (
              exercises.map((item) => (
                <ExerciseItem
                  key={item.id}
                  item={item}
                  onToggle={toggleComplete}
                />
              ))
            )}
          </View>
        </ScrollView>

        {/* Floating Action Button */}
        <View className="absolute bottom-12 right-8">
          <TouchableOpacity
            className="w-20 h-20 bg-[#3a1111] rounded-full items-center justify-center shadow-lg"
            activeOpacity={0.8}
            onPress={() => setAddModalVisible(true)}
          >
            <Plus color="#8a7a7a" size={40} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
      <SyncOptionsModal
        visible={isSyncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onUpload={() => handleOptionSelect("upload")}
        onDownload={(manualId) => handleOptionSelect("download", manualId)}
        currentSyncId={currentSyncId}
      />
      <LoadingModal visible={isLoadingVisible} text={loadingText} />
      <AddWorkoutModal
        visible={isAddModalVisible}
        onClose={() => setAddModalVisible(false)}
        onSuccess={() => {
          console.log("Workout Saved!");
          loadData();
        }}
      />
    </>
  );
}
