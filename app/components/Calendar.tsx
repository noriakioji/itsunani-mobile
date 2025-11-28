import { View, Text, ScrollView } from 'react-native';
import { useState } from 'react';
import { Calendar as RNCalendar } from 'react-native-calendars';
import { styles } from './Calendar.styles';

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  color?: string;
}

interface CalendarProps {
  events?: CalendarEvent[];
}

export function Calendar({ events = [] }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Sample agenda data for today
  const agendaItems = [
    { time: '09:00', title: 'Team standup', color: '#007AFF' },
    { time: '11:00', title: 'Project review', color: '#34C759' },
    { time: '14:00', title: 'Client meeting', color: '#FF9500' },
    { time: '16:30', title: 'Code review', color: '#5856D6' },
  ];

  // Mark dates with events
  const markedDates = {
    [selectedDate]: {
      selected: true,
      selectedColor: '#007AFF',
    },
  };

  return (
    <View style={styles.container}>
      {/* Month Calendar - Fixed */}
      <View style={styles.monthContainer}>
        <RNCalendar
          markedDates={markedDates}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#666',
            selectedDayBackgroundColor: '#007AFF',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#007AFF',
            dayTextColor: '#000',
            textDisabledColor: '#d9d9d9',
            monthTextColor: '#000',
            textMonthFontWeight: '600',
            textDayFontSize: 14,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 12,
            arrowColor: '#007AFF',
            weekVerticalMargin: 4
          }}
        />
      </View>

      {/* Daily Agenda - Scrollable */}
      <ScrollView style={styles.agendaContainer}>
        <View style={styles.agendaList}>
          {agendaItems.map((item, index) => (
            <View key={index} style={styles.agendaItem}>
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{item.time}</Text>
              </View>
              <View style={[styles.eventCard, { borderLeftColor: item.color }]}>
                <Text style={styles.eventTitle}>{item.title}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
