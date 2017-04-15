/*
abstract class ControlFrame {
}

class ReturnFrame extends ControlFrame {
    public constructor(public readonly return_to_index: number) {
        super()
    }
}

class NextFrame extends ControlFrame {
    public constructor(public readonly control: NRef,
                       public readonly to: number,
                       public readonly step: number,
                       public readonly index: number) {
        super()
    }
}

class EndFrame extends ControlFrame {
}

*/
class ControlStack {

/*

        class UDFFrame : ControlFrame
        {
            int _return_to;
            List<Expression> _args;

            public UDFFrame(int return_to, List<Expression> args)
            {
                _return_to = return_to;
                _args = args;
            }
        }

        Stack<ControlFrame> _stack;
        Context _context;

        public ControlStack(Context context)
        {
            _stack = new Stack<ControlFrame>();
            _context = context;
        }
*/
        public clear() : void {
            //this.stack.Clear();
            //this.stack.push(new EndFrame());
        }
/*
        public void doUDF(int lineno, List<Expression> args)
        {
            _stack.Push(new UDFFrame(_context.nextLineNumber, args));
        }

        public void doGosub()
        {
            _stack.Push(new ReturnFrame(_context.nextLineNumber));
        }

        public void doReturn()
        {
            // It isn't clear from the documentation how RETURN interacts with FOR
            // loops. Consider
            //
            // 100 GOSUB 200
            // 110 STOP
            // 200 FOR I=1 TO 10
            // 210 RETURN
            // 220 NEXT I
            //
            // I assume that RETURN pops NEXT elements off the control stack until we
            // find a RETURN element (or run out)
            _context.nextLineNumber = 0;
            while (_context.nextLineNumber == 0)
            {
                ControlFrame frame = _stack.Pop();
                if (frame is ReturnFrame)
                {
                    _context.nextLineNumber = ((ReturnFrame)frame)._return_to;
                }
                else if (frame is NextFrame)
                {
                    // Drop for loops in subroutine
                }
                else if (frame is UDFFrame)
                {
                    throw new RunTimeError(0, ErrorCode.InvExit);
                }
                else
                {
                    throw new RunTimeError(0, ErrorCode.NoReturn);
                }
            }
        }


        public void doFor(NRef index, double to, double step)
        {
            _stack.Push(new NextFrame(index, to, step, _context.nextLineNumber));
        }

        public void doNext(NRef index, Context context)
        {
            // Here, we'll pop items off the control stack until we find the matching
            // NEXT. If we find a return frame or run out, it means this NEXT had no
            // matching FOR.
            var found = false;
            NScalarRef wanted_control = (NScalarRef)index;
            while (!found)
            {
                if (_stack.Peek() is ReturnFrame)
                {
                    throw new RunTimeError(0, ErrorCode.NoFor);
                }
                else if (_stack.Peek() is EndFrame)
                {
                    throw new RunTimeError(0, ErrorCode.NoFor);
                }
                else if (_stack.Peek() is NextFrame)
                {
                    NextFrame next_frame = (NextFrame)_stack.Peek();
                    //case NextFrame(c, limit, step, line) => {
                    // If this is for a nested loop, ignore it (terminating the loop) else
                    // see if we should continue
                    NScalarRef control = (NScalarRef)next_frame._control;
                    if (control.same(wanted_control))
                    {
                        found = true;
                        // Get the next value of the loop control variable
                        var next = index.value(context) + next_frame._step;
                        // If it has passed the limit, we end the loop
                        if ((next_frame._step < 0.0 && next < next_frame._to) || (next_frame._step > 0.0 && next > next_frame._to))
                        {
                            _stack.Pop();
                        }
                        else
                        {
                            // Update the control variable, branch to the start of the loop
                            // and leave the frame on the stack
                            next_frame._control.set(context, next);
                            context.nextLineNumber = next_frame._line;
                        }
                    }
                    else
                    {
                        _stack.Pop();
                    }
                }
            }
        }
*/
}
