package com.hydroleaf.shellycontrol.service;

import com.hydroleaf.shellycontrol.exception.NotFoundException;
import com.hydroleaf.shellycontrol.model.AutomationType;
import com.hydroleaf.shellycontrol.model.ShellyAutomation;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Service
public class AutomationService {

    private final ShellyService shellyService;
    private final TaskScheduler scheduler;
    private final Map<String, ShellyAutomation> automations = new ConcurrentHashMap<>();
    private final Map<String, List<ScheduledFuture<?>>> scheduledTasks = new ConcurrentHashMap<>();

    public AutomationService(ShellyService shellyService) {
        this.shellyService = shellyService;
        ThreadPoolTaskScheduler taskScheduler = new ThreadPoolTaskScheduler();
        taskScheduler.setPoolSize(4);
        taskScheduler.setThreadNamePrefix("shelly-automation-");
        taskScheduler.initialize();
        this.scheduler = taskScheduler;
    }

    public List<ShellyAutomation> listAutomations() {
        return automations.values().stream().toList();
    }

    public ShellyAutomation createAutomation(ShellyAutomation automation) {
        automations.put(automation.getId(), automation);
        scheduleAutomation(automation);
        return automation;
    }

    public void deleteAutomation(String id) {
        ShellyAutomation automation = automations.remove(id);
        if (automation == null) {
            throw new NotFoundException("Automation " + id + " not found");
        }
        cancelTasks(id);
    }

    private void scheduleAutomation(ShellyAutomation automation) {
        cancelTasks(automation.getId());
        List<ScheduledFuture<?>> futures = new ArrayList<>();

        if (automation.getType() == AutomationType.TIME_RANGE) {
            List<DayOfWeek> days = automation.getDaysOfWeek() == null || automation.getDaysOfWeek().isEmpty()
                    ? Arrays.asList(DayOfWeek.values())
                    : automation.getDaysOfWeek();
            for (DayOfWeek day : days) {
                String cronOn = cronAt(day, automation.getStartTime());
                String cronOff = cronAt(day, automation.getEndTime());
                futures.add(scheduler.schedule(() -> shellyService.setState(automation.getSocketId(), true), new CronTrigger(cronOn)));
                futures.add(scheduler.schedule(() -> shellyService.setState(automation.getSocketId(), false), new CronTrigger(cronOff)));
            }
        } else if (automation.getType() == AutomationType.INTERVAL_TOGGLE && automation.getIntervalMinutes() != null) {
            long intervalMillis = automation.getIntervalMinutes() * 60_000L;
            ScheduledFuture<?> future = ((ThreadPoolTaskScheduler) scheduler)
                    .scheduleAtFixedRate(() -> shellyService.toggle(automation.getSocketId()), intervalMillis);
            futures.add(future);
        } else if (automation.getType() == AutomationType.AUTO_OFF && automation.getAutoOffMinutes() != null) {
            shellyService.setState(automation.getSocketId(), true);
            LocalDateTime offAt = LocalDateTime.now().plusMinutes(automation.getAutoOffMinutes());
            ScheduledFuture<?> future = scheduler.schedule(() -> shellyService.setState(automation.getSocketId(), false),
                    Date.from(offAt.atZone(ZoneId.systemDefault()).toInstant()));
            futures.add(future);
        }

        scheduledTasks.put(automation.getId(), futures);
    }

    private void cancelTasks(String automationId) {
        List<ScheduledFuture<?>> futures = scheduledTasks.remove(automationId);
        if (futures != null) {
            futures.forEach(future -> future.cancel(false));
        }
    }

    private String cronAt(DayOfWeek dayOfWeek, LocalTime time) {
        // second minute hour day-of-month month day-of-week
        return String.format("%d %d %d ? * %d", time.getSecond(), time.getMinute(), time.getHour(), dayOfWeek.getValue());
    }
}
