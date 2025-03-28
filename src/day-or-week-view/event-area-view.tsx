import { Locale } from 'date-fns'
import { Event } from '.'
import { useMemo, useState } from 'react'
import { EventAreaGrid } from './event-area-grid'
import { EventArea, HasStartAndEndDate } from './event-area'
import { useResizeObserver } from '../hooks/use-resize-observer'
import { Arranger } from '../arranger'
import { EventViewWithDragObserver } from './event-view-with-drag-observer'
import {
  DraggingCanvas,
  DraggingEventUpdateState,
  DraggingEventUpdate,
} from './dragging-event-update'
import { DragState, useDragObserver } from '../hooks/use-drag-observer'
import { useInvisibleDragHandlers } from '../hooks/use-invisible-drag-handlers'
import { DraggingEventSketch } from './dragging-event-sketch'
import { EventView } from './event-view'

export interface EventAreaViewProps {
  start: Date
  days: number
  events?: Event[]
  dayPaddingRight?: number
  blockPadding?: number
  dragIntervalMs?: number
  minEventSizeMs?: number
  locale?: Locale
  onEventsChange?: (events: Event[]) => void
  onEventSketched?: (sketch: HasStartAndEndDate) => void
}

export function EventAreaView({
  start,
  days,
  events,
  dayPaddingRight,
  blockPadding,
  dragIntervalMs,
  minEventSizeMs,
  locale,
  onEventsChange,
  onEventSketched,
}: EventAreaViewProps) {
  const [eventSketchState, setEventSketchState] = useState<DragState>()
  const [draggingEventUpdateState, setDraggingEventUpdateState] =
    useState<DraggingEventUpdateState>()
  const [wrapperElement, setWrapperElement] = useState<HTMLDivElement | null>(
    null
  )
  const wrapperResizeObserverEntry = useResizeObserver(wrapperElement)

  const eventArea = useMemo(() => {
    if (!wrapperResizeObserverEntry) {
      return
    }

    const eventArea = new EventArea(
      {
        start,
        days,
        width: wrapperResizeObserverEntry.contentRect.width,
        height: wrapperResizeObserverEntry.contentRect.height,
        top: wrapperResizeObserverEntry.target.getBoundingClientRect().top,
        left: wrapperResizeObserverEntry.target.getBoundingClientRect().left,
        blockPadding,
        dayPaddingRight,
        events,
      },
      new Arranger()
    )

    const draggingCanvas: DraggingCanvas = {
      getDateForPosition: eventArea.getDateForPosition.bind(eventArea),
    }

    if (eventSketchState) {
      eventArea.sketch = new DraggingEventSketch(
        eventSketchState,
        draggingCanvas,
        { sizeIntervalMs: dragIntervalMs, minEventSizeMs }
      )
    }

    if (draggingEventUpdateState) {
      eventArea.update = new DraggingEventUpdate(
        draggingEventUpdateState,
        draggingCanvas,
        { dragIntervalMs, minEventSizeMs }
      )
    }

    return eventArea
  }, [
    wrapperResizeObserverEntry,
    start,
    days,
    events,
    dayPaddingRight,
    blockPadding,
    dragIntervalMs,
    minEventSizeMs,
    eventSketchState,
    draggingEventUpdateState,
  ])

  const createEventObserver = useDragObserver({
    onStateChange: setEventSketchState,
    onConfirm: () => {
      if (!eventSketchState || !eventArea || !wrapperResizeObserverEntry) {
        return
      }

      const draggingCanvas: DraggingCanvas = {
        getDateForPosition: eventArea.getDateForPosition.bind(eventArea),
      }

      const eventSketch = new DraggingEventSketch(
        eventSketchState,
        draggingCanvas,
        { sizeIntervalMs: dragIntervalMs, minEventSizeMs }
      )

      onEventSketched?.({
        start: eventSketch.start,
        end: eventSketch.end,
      })
    },
  })
  const invisibleCreateEventHandlers = useInvisibleDragHandlers({
    onDragStart: createEventObserver.onDragStart,
    onDragEnd: createEventObserver.onDragEnd,
  })

  return (
    <div
      ref={setWrapperElement}
      className="relative flex w-full"
      draggable
      onDrag={createEventObserver.onDrag}
      onDragStart={invisibleCreateEventHandlers.onDragStart}
      onDragEnd={invisibleCreateEventHandlers.onDragEnd}
    >
      {eventArea?.getEventBlocks().map(block =>
        block.isSketch ? (
          <EventView
            start={block.sketch.start}
            end={block.sketch.end}
            top={block.top}
            left={block.left}
            height={block.height}
            width={block.width}
            isFloating
            locale={locale}
          />
        ) : (
          <EventViewWithDragObserver
            key={block.key}
            title={block.event.title}
            start={block.event.start}
            end={block.event.end}
            top={block.top}
            left={block.left}
            height={block.height}
            width={block.width}
            locale={locale}
            isFloating={block.isUpdate}
            isTransparent={block.isBeingUpdated}
            isMovable={!block.isUpdate}
            isResizable
            onDragStateChange={dragState =>
              setDraggingEventUpdateState(
                dragState && {
                  behavior: dragState.behavior,
                  eventId: block.event.id,
                  eventEnd: block.event.end,
                  eventDurationMs:
                    block.event.end.getTime() - block.event.start.getTime(),
                  initialClientX: dragState.initialClientX,
                  initialClientY: dragState.initialClientY,
                  clientX: dragState.clientX,
                  clientY: dragState.clientY,
                }
              )
            }
            onDragConfirm={() => {
              if (
                !draggingEventUpdateState ||
                !eventArea ||
                !wrapperResizeObserverEntry
              ) {
                return
              }

              const draggingCanvas: DraggingCanvas = {
                getDateForPosition:
                  eventArea.getDateForPosition.bind(eventArea),
              }

              const draggingEvent = new DraggingEventUpdate(
                draggingEventUpdateState,
                draggingCanvas,
                { dragIntervalMs, minEventSizeMs }
              )

              const updatedEvents = (events || []).map(event => {
                if (event.id === draggingEventUpdateState.eventId) {
                  return {
                    ...event,
                    start: draggingEvent.start,
                    end: draggingEvent.end,
                  }
                }

                return event
              })

              onEventsChange?.(updatedEvents)
            }}
          />
        )
      )}

      <EventAreaGrid days={days} hours={24} />
    </div>
  )
}
